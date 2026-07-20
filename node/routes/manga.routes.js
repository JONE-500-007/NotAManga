const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole, requireMangaOwner } = require("../middleware/auth");
const { coverUpload, chapterPagesUpload, artUpload, PAGES_DIR } = require("../middleware/upload");
const { savePageFiles } = require("../utils/pageStorage");
const { reorderRows } = require("../utils/reorder");
const { deleteUploadedFile } = require("../utils/fileStorage");
const { DEFAULT_AVATAR_PATH } = require("../middleware/upload");
const { visibilityFilter, canViewManga } = require("../utils/mangaVisibility");

const router = express.Router();

router.get("/manga", optionalAuth, async (req, res) => {
  // Pinned manga (admin-ordered) float to the front in the order the admin
  // set; everything else keeps the normal auto sort by upload date. Tags
  // are included so the browse page can search by tag name, not just title.
  const visibility = visibilityFilter(req.user, 1);
  const result = await pool.query(
    `SELECT m.id, m.title, m.cover_path, m.pinned_position, m.is_private,
            COALESCE(
              (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
               FROM manga_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.manga_id = m.id),
              '[]'
            ) AS tags
     FROM manga m
     WHERE ${visibility.clause}
     ORDER BY m.pinned_position IS NULL ASC, m.pinned_position ASC, m.created_at DESC`,
    visibility.params
  );
  res.json(result.rows);
});

router.patch("/manga/reorder", requireAuth, requireRole("admin"), async (req, res) => {
  const { orderedMangaIds } = req.body;
  if (!Array.isArray(orderedMangaIds) || orderedMangaIds.length === 0) {
    return res.status(400).json({ error: "orderedMangaIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reorderRows(client, {
      table: "manga",
      numberColumn: "pinned_position",
      orderedIds: orderedMangaIds,
    });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.patch("/manga/:mangaId/pin", requireAuth, requireRole("admin"), async (req, res) => {
  const { mangaId } = req.params;
  const maxResult = await pool.query("SELECT COALESCE(MAX(pinned_position), 0) AS max FROM manga");
  const position = Number(maxResult.rows[0].max) + 1;

  const result = await pool.query(
    "UPDATE manga SET pinned_position = $1 WHERE id = $2 RETURNING id, title, cover_path, pinned_position",
    [position, mangaId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Manga not found" });
  res.json(result.rows[0]);
});

router.delete("/manga/:mangaId/pin", requireAuth, requireRole("admin"), async (req, res) => {
  const { mangaId } = req.params;
  const result = await pool.query(
    "UPDATE manga SET pinned_position = NULL WHERE id = $1 RETURNING pinned_position",
    [mangaId]
  );
  const unpinned = result.rows[0];
  if (!unpinned) return res.status(404).json({ error: "Manga not found" });

  if (unpinned.pinned_position !== null) {
    await pool.query(
      "UPDATE manga SET pinned_position = pinned_position - 1 WHERE pinned_position > $1",
      [unpinned.pinned_position]
    );
  }

  res.json({ ok: true });
});

router.post("/manga", requireAuth, requireRole("uploader", "admin"), coverUpload.single("cover"), async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const format = req.body.format === "comic" ? "comic" : "manga";
  const coverPath = req.file ? `/uploads/covers/${req.file.filename}` : null;
  const result = await pool.query(
    "INSERT INTO manga (title, description, cover_path, format, uploader_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [title, description || null, coverPath, format, req.user.id]
  );
  res.status(201).json(result.rows[0]);
});

router.get("/manga/:mangaId", optionalAuth, async (req, res) => {
  const { mangaId } = req.params;
  const mangaResult = await pool.query(
    `SELECT m.*, u.username AS uploader_username, u.display_name AS uploader_display_name,
            COALESCE(u.avatar_path, '${DEFAULT_AVATAR_PATH}') AS uploader_avatar_path
     FROM manga m
     JOIN users u ON u.id = m.uploader_id
     WHERE m.id = $1`,
    [mangaId]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return res.status(404).json({ error: "Manga not found" });

  const visibleRolesResult = await pool.query(
    "SELECT role FROM manga_visible_roles WHERE manga_id = $1",
    [mangaId]
  );
  const visibleRoles = visibleRolesResult.rows.map((r) => r.role);
  if (!canViewManga(req.user, manga, visibleRoles)) {
    return res.status(404).json({ error: "Manga not found" });
  }

  const chaptersResult = await pool.query(
    "SELECT id, chapter_number, volume, title, created_at FROM chapters WHERE manga_id = $1 ORDER BY chapter_number ASC",
    [mangaId]
  );
  const tagsResult = await pool.query(
    `SELECT t.id, t.name, t.color FROM manga_tags mt
     JOIN tags t ON t.id = mt.tag_id
     WHERE mt.manga_id = $1 ORDER BY t.name ASC`,
    [mangaId]
  );
  res.json({ ...manga, chapters: chaptersResult.rows, tags: tagsResult.rows, visible_roles: visibleRoles });
});

router.patch(
  "/manga/:mangaId/visibility",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId } = req.params;
    const { is_private, visible_roles } = req.body;
    if (typeof is_private !== "boolean") return res.status(400).json({ error: "is_private is required" });

    const roles = Array.isArray(visible_roles) ? visible_roles.filter((r) => ["member", "vvip"].includes(r)) : [];

    const lockCheck = await pool.query("SELECT privacy_locked_by_admin FROM manga WHERE id = $1", [mangaId]);
    if (lockCheck.rows[0]?.privacy_locked_by_admin && req.user.role !== "admin") {
      return res.status(403).json({ error: "This manga was made private by an admin and can't be changed" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("UPDATE manga SET is_private = $1 WHERE id = $2 RETURNING *", [
        is_private,
        mangaId,
      ]);
      await client.query("DELETE FROM manga_visible_roles WHERE manga_id = $1", [mangaId]);
      if (is_private && roles.length > 0) {
        for (const role of roles) {
          await client.query("INSERT INTO manga_visible_roles (manga_id, role) VALUES ($1, $2)", [mangaId, role]);
        }
      }
      await client.query("COMMIT");
      res.json({ ...result.rows[0], visible_roles: is_private ? roles : [] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch("/manga/:mangaId/admin-lock", requireAuth, requireRole("admin"), async (req, res) => {
  const { mangaId } = req.params;
  const { locked } = req.body;
  if (typeof locked !== "boolean") return res.status(400).json({ error: "locked is required" });

  const result = await pool.query(
    locked
      ? "UPDATE manga SET privacy_locked_by_admin = true, is_private = true WHERE id = $1 RETURNING *"
      : "UPDATE manga SET privacy_locked_by_admin = false WHERE id = $1 RETURNING *",
    [mangaId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Manga not found" });
  res.json(result.rows[0]);
});

router.post(
  "/manga/:mangaId/tags",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId } = req.params;
    const { tagId } = req.body;
    if (!tagId) return res.status(400).json({ error: "tagId is required" });

    const tagCheck = await pool.query("SELECT id, name, color FROM tags WHERE id = $1", [tagId]);
    if (tagCheck.rows.length === 0) return res.status(404).json({ error: "Tag not found" });

    try {
      await pool.query("INSERT INTO manga_tags (manga_id, tag_id) VALUES ($1, $2)", [mangaId, tagId]);
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Tag is already on this manga" });
      throw err;
    }

    res.status(201).json(tagCheck.rows[0]);
  }
);

router.delete(
  "/manga/:mangaId/tags/:tagId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, tagId } = req.params;
    const result = await pool.query(
      "DELETE FROM manga_tags WHERE manga_id = $1 AND tag_id = $2 RETURNING tag_id",
      [mangaId, tagId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Tag is not on this manga" });
    res.json({ ok: true });
  }
);

router.patch(
  "/manga/:mangaId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  coverUpload.single("cover"),
  async (req, res) => {
    const { mangaId } = req.params;
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const format = req.body.format === "comic" ? "comic" : "manga";

    if (req.file) {
      const existing = await pool.query("SELECT cover_path FROM manga WHERE id = $1", [mangaId]);
      await deleteUploadedFile(existing.rows[0]?.cover_path);
    }

    const coverPath = req.file ? `/uploads/covers/${req.file.filename}` : undefined;
    const result = await pool.query(
      `UPDATE manga SET title = $1, description = $2, format = $3, cover_path = COALESCE($4, cover_path) WHERE id = $5 RETURNING *`,
      [title, description || null, format, coverPath || null, mangaId]
    );
    res.json(result.rows[0]);
  }
);

router.delete("/manga/:mangaId", requireAuth, requireRole("uploader", "admin"), requireMangaOwner, async (req, res) => {
  const { mangaId } = req.params;

  const mangaResult = await pool.query("SELECT cover_path FROM manga WHERE id = $1", [mangaId]);
  const chaptersResult = await pool.query("SELECT id FROM chapters WHERE manga_id = $1", [mangaId]);

  await deleteUploadedFile(mangaResult.rows[0]?.cover_path);
  await Promise.all(
    chaptersResult.rows.map((c) =>
      fs.rm(path.join(PAGES_DIR, String(c.id)), { recursive: true, force: true }).catch(() => {})
    )
  );

  await pool.query("DELETE FROM manga WHERE id = $1", [mangaId]);
  res.json({ ok: true });
});

router.post(
  "/manga/:mangaId/chapters",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  chapterPagesUpload.array("pages"),
  async (req, res) => {
    const { mangaId } = req.params;
    const { chapter_number, title, volume } = req.body;
    if (!chapter_number) return res.status(400).json({ error: "Chapter number is required" });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one page image is required" });
    }

    const client = await pool.connect();
    let chapterDir;
    try {
      await client.query("BEGIN");

      const mangaCheck = await client.query("SELECT id FROM manga WHERE id = $1", [mangaId]);
      if (mangaCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Manga not found" });
      }

      const chapterResult = await client.query(
        "INSERT INTO chapters (manga_id, chapter_number, title, volume) VALUES ($1, $2, $3, $4) RETURNING *",
        [mangaId, chapter_number, title || null, volume || null]
      );
      const chapter = chapterResult.rows[0];

      chapterDir = path.join(PAGES_DIR, String(chapter.id));
      await savePageFiles(client, { chapterId: chapter.id, chapterDir, files: req.files, startPageNumber: 1 });

      await client.query("COMMIT");
      res.status(201).json(chapter);
    } catch (err) {
      await client.query("ROLLBACK");
      if (chapterDir) {
        await fs.rm(chapterDir, { recursive: true, force: true }).catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/manga/:mangaId/chapters/reorder",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId } = req.params;
    const { orderedChapterIds } = req.body;
    if (!Array.isArray(orderedChapterIds) || orderedChapterIds.length === 0) {
      return res.status(400).json({ error: "orderedChapterIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "chapters",
        numberColumn: "chapter_number",
        parentColumn: "manga_id",
        parentId: mangaId,
        orderedIds: orderedChapterIds,
      });
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/manga/:mangaId/chapters/:chapterId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, chapterId } = req.params;
    const { chapter_number, title, volume } = req.body;
    if (!chapter_number) return res.status(400).json({ error: "Chapter number is required" });

    const result = await pool.query(
      "UPDATE chapters SET chapter_number = $1, title = $2, volume = $3 WHERE id = $4 AND manga_id = $5 RETURNING *",
      [chapter_number, title || null, volume || null, chapterId, mangaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });
    res.json(result.rows[0]);
  }
);

router.delete(
  "/manga/:mangaId/chapters/:chapterId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, chapterId } = req.params;
    const result = await pool.query(
      "DELETE FROM chapters WHERE id = $1 AND manga_id = $2 RETURNING id",
      [chapterId, mangaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });

    await fs.rm(path.join(PAGES_DIR, String(chapterId)), { recursive: true, force: true }).catch(() => {});
    res.json({ ok: true });
  }
);

router.get("/manga/:mangaId/chapters/:chapterId", optionalAuth, async (req, res) => {
  const { mangaId, chapterId } = req.params;

  const chapterResult = await pool.query(
    "SELECT * FROM chapters WHERE id = $1 AND manga_id = $2",
    [chapterId, mangaId]
  );
  const chapter = chapterResult.rows[0];
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });

  const pagesResult = await pool.query(
    "SELECT id, page_number, image_path FROM pages WHERE chapter_id = $1 ORDER BY page_number ASC",
    [chapterId]
  );

  const siblingsResult = await pool.query(
    "SELECT id, chapter_number FROM chapters WHERE manga_id = $1 ORDER BY chapter_number ASC",
    [mangaId]
  );
  const siblings = siblingsResult.rows;
  const currentIndex = siblings.findIndex((c) => c.id === chapter.id);
  const prevChapterId = currentIndex > 0 ? siblings[currentIndex - 1].id : null;
  const nextChapterId =
    currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].id : null;

  res.json({ ...chapter, pages: pagesResult.rows, prevChapterId, nextChapterId });
});

router.post(
  "/manga/:mangaId/chapters/:chapterId/pages",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  chapterPagesUpload.array("pages"),
  async (req, res) => {
    const { chapterId } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one page image is required" });
    }

    const chapterCheck = await pool.query("SELECT id FROM chapters WHERE id = $1", [chapterId]);
    if (chapterCheck.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(page_number), 0) AS max FROM pages WHERE chapter_id = $1",
      [chapterId]
    );
    const startPageNumber = Number(maxResult.rows[0].max) + 1;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const chapterDir = path.join(PAGES_DIR, String(chapterId));
      await savePageFiles(client, { chapterId, chapterDir, files: req.files, startPageNumber });
      await client.query("COMMIT");

      const pagesResult = await pool.query(
        "SELECT id, page_number, image_path FROM pages WHERE chapter_id = $1 ORDER BY page_number ASC",
        [chapterId]
      );
      res.status(201).json(pagesResult.rows);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/manga/:mangaId/chapters/:chapterId/pages/reorder",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { chapterId } = req.params;
    const { orderedPageIds } = req.body;
    if (!Array.isArray(orderedPageIds) || orderedPageIds.length === 0) {
      return res.status(400).json({ error: "orderedPageIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "pages",
        numberColumn: "page_number",
        parentColumn: "chapter_id",
        parentId: chapterId,
        orderedIds: orderedPageIds,
      });
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/manga/:mangaId/chapters/:chapterId/pages/:pageId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { chapterId, pageId } = req.params;

    const result = await pool.query(
      "DELETE FROM pages WHERE id = $1 AND chapter_id = $2 RETURNING page_number, image_path",
      [pageId, chapterId]
    );
    const deleted = result.rows[0];
    if (!deleted) return res.status(404).json({ error: "Page not found" });

    await deleteUploadedFile(deleted.image_path);
    await pool.query(
      "UPDATE pages SET page_number = page_number - 1 WHERE chapter_id = $1 AND page_number > $2",
      [chapterId, deleted.page_number]
    );

    res.json({ ok: true });
  }
);

router.get("/manga/:mangaId/art", optionalAuth, async (req, res) => {
  const { mangaId } = req.params;
  const result = await pool.query(
    "SELECT id, image_path, caption, position FROM art WHERE manga_id = $1 ORDER BY position ASC",
    [mangaId]
  );
  res.json(result.rows);
});

router.post(
  "/manga/:mangaId/art",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  artUpload.single("image"),
  async (req, res) => {
    const { mangaId } = req.params;
    const { caption } = req.body;
    if (!req.file) return res.status(400).json({ error: "An image file is required" });

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(position), 0) AS max FROM art WHERE manga_id = $1",
      [mangaId]
    );
    const position = Number(maxResult.rows[0].max) + 1;

    const imagePath = `/uploads/art/${req.file.filename}`;
    const result = await pool.query(
      "INSERT INTO art (manga_id, image_path, caption, position) VALUES ($1, $2, $3, $4) RETURNING *",
      [mangaId, imagePath, caption || null, position]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.patch(
  "/manga/:mangaId/art/reorder",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId } = req.params;
    const { orderedArtIds } = req.body;
    if (!Array.isArray(orderedArtIds) || orderedArtIds.length === 0) {
      return res.status(400).json({ error: "orderedArtIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "art",
        numberColumn: "position",
        parentColumn: "manga_id",
        parentId: mangaId,
        orderedIds: orderedArtIds,
      });
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/manga/:mangaId/art/:artId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, artId } = req.params;
    const { caption } = req.body;

    const result = await pool.query(
      "UPDATE art SET caption = $1 WHERE id = $2 AND manga_id = $3 RETURNING *",
      [caption || null, artId, mangaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Art not found" });
    res.json(result.rows[0]);
  }
);

router.delete(
  "/manga/:mangaId/art/:artId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, artId } = req.params;

    const result = await pool.query(
      "DELETE FROM art WHERE id = $1 AND manga_id = $2 RETURNING position, image_path",
      [artId, mangaId]
    );
    const deleted = result.rows[0];
    if (!deleted) return res.status(404).json({ error: "Art not found" });

    await deleteUploadedFile(deleted.image_path);
    await pool.query(
      "UPDATE art SET position = position - 1 WHERE manga_id = $1 AND position > $2",
      [mangaId, deleted.position]
    );

    res.json({ ok: true });
  }
);

module.exports = router;

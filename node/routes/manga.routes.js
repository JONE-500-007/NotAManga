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

const router = express.Router();

router.get("/manga", optionalAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, cover_path FROM manga ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

router.post("/manga", requireAuth, requireRole("uploader", "admin"), coverUpload.single("cover"), async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const coverPath = req.file ? `/uploads/covers/${req.file.filename}` : null;
  const result = await pool.query(
    "INSERT INTO manga (title, description, cover_path, uploader_id) VALUES ($1, $2, $3, $4) RETURNING *",
    [title, description || null, coverPath, req.user.id]
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

  const chaptersResult = await pool.query(
    "SELECT id, chapter_number, volume, title, created_at FROM chapters WHERE manga_id = $1 ORDER BY chapter_number ASC",
    [mangaId]
  );
  res.json({ ...manga, chapters: chaptersResult.rows });
});

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

    if (req.file) {
      const existing = await pool.query("SELECT cover_path FROM manga WHERE id = $1", [mangaId]);
      await deleteUploadedFile(existing.rows[0]?.cover_path);
    }

    const coverPath = req.file ? `/uploads/covers/${req.file.filename}` : undefined;
    const result = await pool.query(
      `UPDATE manga SET title = $1, description = $2, cover_path = COALESCE($3, cover_path) WHERE id = $4 RETURNING *`,
      [title, description || null, coverPath || null, mangaId]
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

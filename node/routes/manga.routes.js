const express = require("express");
const fs = require("fs/promises");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole, requireMangaOwner } = require("../middleware/auth");
const {
  coverUpload,
  chapterPagesUpload,
  artUpload,
  novelImageUpload,
} = require("../middleware/upload");
const { savePageFiles } = require("../utils/pageStorage");
const { saveNovelBlocks } = require("../utils/novelBlocks");
const { reorderRows } = require("../utils/reorder");
const { reorderChapters, renameChapterFolder } = require("../utils/chapterReorder");
const {
  saveMangaImage,
  removeMangaDir,
  removeChapterDir,
  chapterDir,
  COVERS,
  ART,
} = require("../utils/mangaStorage");
const { deleteUploadedFile } = require("../utils/fileStorage");
const { DEFAULT_AVATAR_PATH } = require("../middleware/upload");
const { visibilityFilter, canViewManga } = require("../utils/mangaVisibility");
const {
  assertBoundedNumber,
  assertMaxLength,
  assertStatus,
  assertStringArray,
  MAX_CHAPTER_NUMBER,
  MAX_VOLUME_NUMBER,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_AUTHOR_LENGTH,
  MAX_ARTIST_LENGTH,
  MAX_AUTHORS,
  MAX_ARTISTS,
  MAX_ALTERNATIVE_TITLES,
  MAX_ALTERNATIVE_TITLE_LENGTH,
} = require("../utils/validation");
const { validateAndNormalizeLinks } = require("../utils/mangaSites");

const router = express.Router();

// Replaces a manga's alternative-titles and links rows to match the
// (already-validated) lists from the request — simplest to reason about
// since the edit form always resubmits its full current lists rather than
// diffing, same approach as novel_blocks on chapter edit.
async function replaceMangaSideTables(client, mangaId, { alternativeTitles, authors, artists, links }) {
  await client.query("DELETE FROM manga_alternative_titles WHERE manga_id = $1", [mangaId]);
  for (let i = 0; i < alternativeTitles.length; i++) {
    await client.query(
      "INSERT INTO manga_alternative_titles (manga_id, title, position) VALUES ($1, $2, $3)",
      [mangaId, alternativeTitles[i].trim(), i + 1]
    );
  }

  await client.query("DELETE FROM manga_credits WHERE manga_id = $1", [mangaId]);
  for (let i = 0; i < authors.length; i++) {
    await client.query(
      "INSERT INTO manga_credits (manga_id, kind, name, position) VALUES ($1, 'author', $2, $3)",
      [mangaId, authors[i].trim(), i + 1]
    );
  }
  for (let i = 0; i < artists.length; i++) {
    await client.query(
      "INSERT INTO manga_credits (manga_id, kind, name, position) VALUES ($1, 'artist', $2, $3)",
      [mangaId, artists[i].trim(), i + 1]
    );
  }

  await client.query("DELETE FROM manga_links WHERE manga_id = $1", [mangaId]);
  const positionByCategory = {};
  for (const link of links) {
    const position = (positionByCategory[link.category] = (positionByCategory[link.category] || 0) + 1);
    await client.query(
      `INSERT INTO manga_links (manga_id, category, site_id, url, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [mangaId, link.category, link.site_id, link.url, position]
    );
  }
}

// Looked up before validating a links payload so validateAndNormalizeLinks
// can confirm every site_id actually exists and matches its stated
// category, without itself needing DB access.
async function getSiteCategoryMap() {
  const result = await pool.query("SELECT id, category FROM link_sites");
  return new Map(result.rows.map((r) => [r.id, r.category]));
}

async function fetchMangaSideTables(mangaId) {
  const [altTitlesResult, creditsResult, linksResult] = await Promise.all([
    pool.query(
      "SELECT title FROM manga_alternative_titles WHERE manga_id = $1 ORDER BY position ASC",
      [mangaId]
    ),
    pool.query(
      "SELECT kind, name FROM manga_credits WHERE manga_id = $1 ORDER BY kind ASC, position ASC",
      [mangaId]
    ),
    pool.query(
      `SELECT ml.category, ml.url, ls.id AS site_id, ls.name AS site_name, ls.icon_path AS site_icon_path
       FROM manga_links ml
       JOIN link_sites ls ON ls.id = ml.site_id
       WHERE ml.manga_id = $1 ORDER BY ml.category ASC, ml.position ASC`,
      [mangaId]
    ),
  ]);
  return {
    alternative_titles: altTitlesResult.rows.map((r) => r.title),
    authors: creditsResult.rows.filter((r) => r.kind === "author").map((r) => r.name),
    artists: creditsResult.rows.filter((r) => r.kind === "artist").map((r) => r.name),
    links: linksResult.rows,
  };
}

router.get("/manga", optionalAuth, async (req, res) => {
  // Pinned manga (admin-ordered) float to the front in the order the admin
  // set; everything else keeps the normal auto sort by upload date. Tags
  // are included so the browse page can search by tag name, not just title.
  const visibility = visibilityFilter(req.user, 1);
  const result = await pool.query(
    `SELECT m.id, m.title, m.cover_path, m.pinned_position, m.is_private,
            COALESCE(
              (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY mt.position)
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
  assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
  assertMaxLength(description, { label: "Description", max: MAX_DESCRIPTION_LENGTH });

  const status = req.body.status || "ongoing";
  assertStatus(status);

  // alternative_titles/authors/artists/links arrive as JSON strings
  // (multipart fields are flat text) — same pattern novel chapters use for
  // their `blocks` field.
  let alternativeTitles;
  try {
    alternativeTitles = req.body.alternative_titles ? JSON.parse(req.body.alternative_titles) : [];
  } catch {
    return res.status(400).json({ error: "Invalid alternative_titles" });
  }
  assertStringArray(alternativeTitles, {
    label: "Alternative titles",
    maxItems: MAX_ALTERNATIVE_TITLES,
    maxItemLength: MAX_ALTERNATIVE_TITLE_LENGTH,
  });

  let authors;
  try {
    authors = req.body.authors ? JSON.parse(req.body.authors) : [];
  } catch {
    return res.status(400).json({ error: "Invalid authors" });
  }
  assertStringArray(authors, { label: "Authors", maxItems: MAX_AUTHORS, maxItemLength: MAX_AUTHOR_LENGTH });

  let artists;
  try {
    artists = req.body.artists ? JSON.parse(req.body.artists) : [];
  } catch {
    return res.status(400).json({ error: "Invalid artists" });
  }
  assertStringArray(artists, { label: "Artists", maxItems: MAX_ARTISTS, maxItemLength: MAX_ARTIST_LENGTH });

  let rawLinks;
  try {
    rawLinks = req.body.links ? JSON.parse(req.body.links) : [];
  } catch {
    return res.status(400).json({ error: "Invalid links" });
  }
  const links = validateAndNormalizeLinks(rawLinks, await getSiteCategoryMap()) || [];

  const workType = req.body.work_type === "novel" ? "novel" : "manga";
  const format = req.body.format === "comic" ? "comic" : "manga";

  const client = await pool.connect();
  let createdMangaId;
  try {
    await client.query("BEGIN");
    // The cover can't be written before the INSERT any more: its folder is
    // named after the manga's id, which only exists once the row does. Insert
    // first, then save the file and patch the path in the same transaction.
    const result = await client.query(
      `INSERT INTO manga (title, description, cover_path, format, work_type, uploader_id, status)
       VALUES ($1, $2, NULL, $3, $4, $5, $6) RETURNING *`,
      [title, description || null, format, workType, req.user.id, status]
    );
    let manga = result.rows[0];
    createdMangaId = manga.id;

    if (req.file) {
      const coverPath = await saveMangaImage(req.file, workType, manga.id, COVERS);
      const updated = await client.query("UPDATE manga SET cover_path = $1 WHERE id = $2 RETURNING *", [
        coverPath,
        manga.id,
      ]);
      manga = updated.rows[0];
    }

    await replaceMangaSideTables(client, manga.id, { alternativeTitles, authors, artists, links });
    await client.query("COMMIT");
    res.status(201).json({ ...manga, alternative_titles: alternativeTitles, authors, artists, links });
  } catch (err) {
    await client.query("ROLLBACK");
    // The rolled-back row takes its id with it, so the folder that id names is
    // orphaned unless it goes too.
    if (createdMangaId) await removeMangaDir(workType, createdMangaId);
    throw err;
  } finally {
    client.release();
  }
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
     WHERE mt.manga_id = $1 ORDER BY mt.position ASC`,
    [mangaId]
  );

  const ratingResult = await pool.query(
    "SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*) AS count FROM manga_ratings WHERE manga_id = $1",
    [mangaId]
  );
  let userRating = null;
  if (req.user) {
    const userRatingResult = await pool.query(
      "SELECT rating FROM manga_ratings WHERE manga_id = $1 AND user_id = $2",
      [mangaId, req.user.id]
    );
    userRating = userRatingResult.rows[0]?.rating ?? null;
  }

  const { alternative_titles: alternativeTitles, authors, artists, links } = await fetchMangaSideTables(mangaId);

  res.json({
    ...manga,
    chapters: chaptersResult.rows,
    tags: tagsResult.rows,
    visible_roles: visibleRoles,
    rating_average: Number(ratingResult.rows[0].average),
    rating_count: Number(ratingResult.rows[0].count),
    user_rating: userRating,
    alternative_titles: alternativeTitles,
    authors,
    artists,
    links,
  });
});

router.patch("/manga/:mangaId/rating", requireAuth, async (req, res) => {
  const { mangaId } = req.params;
  const { rating } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be an integer from 1 to 5" });
  }

  const mangaCheck = await pool.query("SELECT id FROM manga WHERE id = $1", [mangaId]);
  if (mangaCheck.rows.length === 0) return res.status(404).json({ error: "Manga not found" });

  await pool.query(
    `INSERT INTO manga_ratings (manga_id, user_id, rating) VALUES ($1, $2, $3)
     ON CONFLICT (manga_id, user_id) DO UPDATE SET rating = EXCLUDED.rating`,
    [mangaId, req.user.id, rating]
  );

  const ratingResult = await pool.query(
    "SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*) AS count FROM manga_ratings WHERE manga_id = $1",
    [mangaId]
  );
  res.json({
    user_rating: rating,
    rating_average: Number(ratingResult.rows[0].average),
    rating_count: Number(ratingResult.rows[0].count),
  });
});

router.delete("/manga/:mangaId/rating", requireAuth, async (req, res) => {
  const { mangaId } = req.params;
  await pool.query("DELETE FROM manga_ratings WHERE manga_id = $1 AND user_id = $2", [mangaId, req.user.id]);

  const ratingResult = await pool.query(
    "SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*) AS count FROM manga_ratings WHERE manga_id = $1",
    [mangaId]
  );
  res.json({
    user_rating: null,
    rating_average: Number(ratingResult.rows[0].average),
    rating_count: Number(ratingResult.rows[0].count),
  });
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

    const roles = Array.isArray(visible_roles)
      ? visible_roles.filter((r) => ["member", "vvip", "uploader"].includes(r))
      : [];

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

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(position), 0) AS max FROM manga_tags WHERE manga_id = $1",
      [mangaId]
    );
    const position = Number(maxResult.rows[0].max) + 1;

    try {
      await pool.query("INSERT INTO manga_tags (manga_id, tag_id, position) VALUES ($1, $2, $3)", [
        mangaId,
        tagId,
        position,
      ]);
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Tag is already on this manga" });
      throw err;
    }

    res.status(201).json(tagCheck.rows[0]);
  }
);

router.patch(
  "/manga/:mangaId/tags/reorder",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId } = req.params;
    const { orderedTagIds } = req.body;
    if (!Array.isArray(orderedTagIds) || orderedTagIds.length === 0) {
      return res.status(400).json({ error: "orderedTagIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "manga_tags",
        numberColumn: "position",
        parentColumn: "manga_id",
        parentId: mangaId,
        idColumn: "tag_id",
        orderedIds: orderedTagIds,
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
  "/manga/:mangaId/tags/:tagId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, tagId } = req.params;
    const result = await pool.query(
      "DELETE FROM manga_tags WHERE manga_id = $1 AND tag_id = $2 RETURNING position",
      [mangaId, tagId]
    );
    const deleted = result.rows[0];
    if (!deleted) return res.status(404).json({ error: "Tag is not on this manga" });

    await pool.query(
      "UPDATE manga_tags SET position = position - 1 WHERE manga_id = $1 AND position > $2",
      [mangaId, deleted.position]
    );

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
    assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
    assertMaxLength(description, { label: "Description", max: MAX_DESCRIPTION_LENGTH });

    const status = req.body.status || "ongoing";
    assertStatus(status);

    let alternativeTitles;
    try {
      alternativeTitles = req.body.alternative_titles ? JSON.parse(req.body.alternative_titles) : [];
    } catch {
      return res.status(400).json({ error: "Invalid alternative_titles" });
    }
    assertStringArray(alternativeTitles, {
      label: "Alternative titles",
      maxItems: MAX_ALTERNATIVE_TITLES,
      maxItemLength: MAX_ALTERNATIVE_TITLE_LENGTH,
    });

    let authors;
    try {
      authors = req.body.authors ? JSON.parse(req.body.authors) : [];
    } catch {
      return res.status(400).json({ error: "Invalid authors" });
    }
    assertStringArray(authors, { label: "Authors", maxItems: MAX_AUTHORS, maxItemLength: MAX_AUTHOR_LENGTH });

    let artists;
    try {
      artists = req.body.artists ? JSON.parse(req.body.artists) : [];
    } catch {
      return res.status(400).json({ error: "Invalid artists" });
    }
    assertStringArray(artists, { label: "Artists", maxItems: MAX_ARTISTS, maxItemLength: MAX_ARTIST_LENGTH });

    let rawLinks;
    try {
      rawLinks = req.body.links ? JSON.parse(req.body.links) : [];
    } catch {
      return res.status(400).json({ error: "Invalid links" });
    }
    const links = validateAndNormalizeLinks(rawLinks, await getSiteCategoryMap()) || [];

    const format = req.body.format === "comic" ? "comic" : "manga";

    if (req.file) {
      const existing = await pool.query("SELECT cover_path FROM manga WHERE id = $1", [mangaId]);
      await deleteUploadedFile(existing.rows[0]?.cover_path);
    }

    const coverPath = req.file ? await saveMangaImage(req.file, req.manga.work_type, mangaId, COVERS) : undefined;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE manga
         SET title = $1, description = $2, format = $3, cover_path = COALESCE($4, cover_path), status = $5
         WHERE id = $6 RETURNING *`,
        [title, description || null, format, coverPath || null, status, mangaId]
      );
      await replaceMangaSideTables(client, mangaId, { alternativeTitles, authors, artists, links });
      await client.query("COMMIT");
      res.json({ ...result.rows[0], alternative_titles: alternativeTitles, authors, artists, links });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.delete("/manga/:mangaId", requireAuth, requireRole("uploader", "admin"), requireMangaOwner, async (req, res) => {
  const { mangaId } = req.params;

  // Cover, art, novel images and every chapter's pages all sit under this one
  // folder now, so the whole lot goes in a single recursive remove instead of
  // chasing each file across the shared top-level directories.
  await removeMangaDir(req.manga.work_type, mangaId);

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
    assertBoundedNumber(chapter_number, { label: "Chapter number", max: MAX_CHAPTER_NUMBER });
    assertBoundedNumber(volume, { label: "Volume", max: MAX_VOLUME_NUMBER, optional: true });
    assertMaxLength(title, { label: "Chapter title", max: MAX_TITLE_LENGTH });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one page image is required" });
    }

    const client = await pool.connect();
    let createdChapterDir;
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

      createdChapterDir = chapterDir(req.manga.work_type, mangaId, chapter.chapter_number);
      await savePageFiles(client, {
        chapterId: chapter.id,
        workType: req.manga.work_type,
        mangaId,
        chapterNumber: chapter.chapter_number,
        files: req.files,
        startPageNumber: 1,
      });

      await client.query("COMMIT");
      res.status(201).json(chapter);
    } catch (err) {
      await client.query("ROLLBACK");
      if (createdChapterDir) {
        await fs.rm(createdChapterDir, { recursive: true, force: true }).catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

router.post(
  "/manga/:mangaId/novel-chapters",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  novelImageUpload.array("images"),
  async (req, res) => {
    const { mangaId } = req.params;
    const { chapter_number, title, volume } = req.body;
    if (!chapter_number) return res.status(400).json({ error: "Chapter number is required" });
    assertBoundedNumber(chapter_number, { label: "Chapter number", max: MAX_CHAPTER_NUMBER });
    assertBoundedNumber(volume, { label: "Volume", max: MAX_VOLUME_NUMBER, optional: true });
    assertMaxLength(title, { label: "Chapter title", max: MAX_TITLE_LENGTH });

    let blocks;
    try {
      blocks = JSON.parse(req.body.blocks || "[]");
    } catch {
      return res.status(400).json({ error: "Invalid blocks" });
    }
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: "At least one block is required" });
    }

    const client = await pool.connect();
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

      await saveNovelBlocks(client, { chapterId: chapter.id, workType: req.manga.work_type, mangaId, blocks, files: req.files || [] });

      await client.query("COMMIT");
      res.status(201).json(chapter);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.patch(
  "/manga/:mangaId/novel-chapters/:chapterId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  novelImageUpload.array("images"),
  async (req, res) => {
    const { mangaId, chapterId } = req.params;
    const { chapter_number, title, volume } = req.body;
    if (!chapter_number) return res.status(400).json({ error: "Chapter number is required" });
    assertBoundedNumber(chapter_number, { label: "Chapter number", max: MAX_CHAPTER_NUMBER });
    assertBoundedNumber(volume, { label: "Volume", max: MAX_VOLUME_NUMBER, optional: true });
    assertMaxLength(title, { label: "Chapter title", max: MAX_TITLE_LENGTH });

    let blocks;
    try {
      blocks = JSON.parse(req.body.blocks || "[]");
    } catch {
      return res.status(400).json({ error: "Invalid blocks" });
    }
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: "At least one block is required" });
    }

    const existingBlocksResult = await pool.query(
      "SELECT image_path FROM novel_blocks WHERE chapter_id = $1 AND block_type = 'image'",
      [chapterId]
    );
    const keptImagePaths = new Set(
      blocks.filter((b) => b.type === "image" && b.existingPath).map((b) => b.existingPath)
    );
    const removedImagePaths = existingBlocksResult.rows
      .map((r) => r.image_path)
      .filter((p) => !keptImagePaths.has(p));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const chapterResult = await client.query(
        "UPDATE chapters SET chapter_number = $1, title = $2, volume = $3 WHERE id = $4 AND manga_id = $5 RETURNING *",
        [chapter_number, title || null, volume || null, chapterId, mangaId]
      );
      if (chapterResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Chapter not found" });
      }

      await client.query("DELETE FROM novel_blocks WHERE chapter_id = $1", [chapterId]);
      await saveNovelBlocks(client, { chapterId, workType: req.manga.work_type, mangaId, blocks, files: req.files || [] });

      await client.query("COMMIT");
      await Promise.all(removedImagePaths.map((p) => deleteUploadedFile(p)));

      const blocksResult = await pool.query(
        "SELECT id, position, block_type, content, image_path FROM novel_blocks WHERE chapter_id = $1 ORDER BY position ASC",
        [chapterId]
      );
      res.json({ ...chapterResult.rows[0], blocks: blocksResult.rows });
    } catch (err) {
      await client.query("ROLLBACK");
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
      // Not the generic reorderRows: chapter numbers are reader-facing (5.5
      // side stories and the like) and name the folders their pages live in,
      // so they get permuted rather than renumbered, and the matching
      // directories move with them. See utils/chapterReorder.js.
      await reorderChapters(client, { workType: req.manga.work_type, mangaId, orderedChapterIds });
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
    assertBoundedNumber(chapter_number, { label: "Chapter number", max: MAX_CHAPTER_NUMBER });
    assertBoundedNumber(volume, { label: "Volume", max: MAX_VOLUME_NUMBER, optional: true });
    assertMaxLength(title, { label: "Chapter title", max: MAX_TITLE_LENGTH });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT chapter_number FROM chapters WHERE id = $1 AND manga_id = $2",
        [chapterId, mangaId]
      );
      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Chapter not found" });
      }

      const result = await client.query(
        "UPDATE chapters SET chapter_number = $1, title = $2, volume = $3 WHERE id = $4 AND manga_id = $5 RETURNING *",
        [chapter_number, title || null, volume || null, chapterId, mangaId]
      );
      // The number names this chapter's page folder, so renumbering by hand
      // has to carry the files across the same way a drag-reorder does.
      await renameChapterFolder(client, {
        workType: req.manga.work_type,
        mangaId,
        chapterId,
        fromNumber: existing.rows[0].chapter_number,
        toNumber: chapter_number,
      });
      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/manga/:mangaId/chapters/:chapterId",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  async (req, res) => {
    const { mangaId, chapterId } = req.params;
    const novelImagesResult = await pool.query(
      "SELECT image_path FROM novel_blocks WHERE chapter_id = $1 AND block_type = 'image'",
      [chapterId]
    );
    const result = await pool.query(
      "DELETE FROM chapters WHERE id = $1 AND manga_id = $2 RETURNING id, chapter_number",
      [chapterId, mangaId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });

    await removeChapterDir(req.manga.work_type, mangaId, result.rows[0].chapter_number);
    await Promise.all(novelImagesResult.rows.map((r) => deleteUploadedFile(r.image_path)));
    res.json({ ok: true });
  }
);

router.get("/manga/:mangaId/chapters/:chapterId", optionalAuth, async (req, res) => {
  const { mangaId, chapterId } = req.params;

  const mangaResult = await pool.query(
    "SELECT work_type, uploader_id, is_private FROM manga WHERE id = $1",
    [mangaId]
  );
  if (mangaResult.rows.length === 0) return res.status(404).json({ error: "Manga not found" });
  const manga = mangaResult.rows[0];
  const { work_type: workType, uploader_id: uploaderId } = manga;

  const visibleRolesResult = await pool.query(
    "SELECT role FROM manga_visible_roles WHERE manga_id = $1",
    [mangaId]
  );
  if (!canViewManga(req.user, manga, visibleRolesResult.rows.map((r) => r.role))) {
    return res.status(404).json({ error: "Manga not found" });
  }

  const chapterResult = await pool.query(
    "SELECT * FROM chapters WHERE id = $1 AND manga_id = $2",
    [chapterId, mangaId]
  );
  const chapter = chapterResult.rows[0];
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });

  // Counts as a "view" of the manga overall (shown to readers) and of this
  // specific chapter (backend-only, for the admin dashboard). The
  // uploader/an admin fetching this same route to load the edit-chapter
  // form (EditChapterPage/EditNovelChapterPage) shouldn't inflate either.
  const isOwnerRequest = req.user && (req.user.id === uploaderId || req.user.role === "admin");
  if (!isOwnerRequest) {
    await pool.query("UPDATE manga SET view_count = view_count + 1 WHERE id = $1", [mangaId]);
    await pool.query("UPDATE chapters SET view_count = view_count + 1 WHERE id = $1", [chapterId]);
    await pool.query("INSERT INTO view_events (manga_id, chapter_id) VALUES ($1, $2)", [mangaId, chapterId]);
  }

  const siblingsResult = await pool.query(
    "SELECT id, chapter_number FROM chapters WHERE manga_id = $1 ORDER BY chapter_number ASC",
    [mangaId]
  );
  const siblings = siblingsResult.rows;
  const currentIndex = siblings.findIndex((c) => c.id === chapter.id);
  const prevChapterId = currentIndex > 0 ? siblings[currentIndex - 1].id : null;
  const nextChapterId =
    currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].id : null;

  if (workType === "novel") {
    const blocksResult = await pool.query(
      "SELECT id, position, block_type, content, image_path FROM novel_blocks WHERE chapter_id = $1 ORDER BY position ASC",
      [chapterId]
    );
    return res.json({ ...chapter, blocks: blocksResult.rows, prevChapterId, nextChapterId });
  }

  const pagesResult = await pool.query(
    "SELECT id, page_number, image_path FROM pages WHERE chapter_id = $1 ORDER BY page_number ASC",
    [chapterId]
  );
  res.json({ ...chapter, pages: pagesResult.rows, prevChapterId, nextChapterId });
});

router.post(
  "/manga/:mangaId/chapters/:chapterId/pages",
  requireAuth,
  requireRole("uploader", "admin"),
  requireMangaOwner,
  chapterPagesUpload.array("pages"),
  async (req, res) => {
    const { mangaId, chapterId } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one page image is required" });
    }

    const chapterCheck = await pool.query("SELECT id, chapter_number FROM chapters WHERE id = $1", [chapterId]);
    if (chapterCheck.rows.length === 0) return res.status(404).json({ error: "Chapter not found" });

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(page_number), 0) AS max FROM pages WHERE chapter_id = $1",
      [chapterId]
    );
    const startPageNumber = Number(maxResult.rows[0].max) + 1;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await savePageFiles(client, {
        chapterId,
        workType: req.manga.work_type,
        mangaId,
        chapterNumber: chapterCheck.rows[0].chapter_number,
        files: req.files,
        startPageNumber,
      });
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

  const mangaResult = await pool.query(
    "SELECT uploader_id, is_private FROM manga WHERE id = $1",
    [mangaId]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return res.status(404).json({ error: "Manga not found" });

  const visibleRolesResult = await pool.query(
    "SELECT role FROM manga_visible_roles WHERE manga_id = $1",
    [mangaId]
  );
  if (!canViewManga(req.user, manga, visibleRolesResult.rows.map((r) => r.role))) {
    return res.status(404).json({ error: "Manga not found" });
  }

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

    const imagePath = await saveMangaImage(req.file, req.manga.work_type, mangaId, ART);
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

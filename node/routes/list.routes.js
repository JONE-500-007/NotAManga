const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { visibilityFilter } = require("../utils/mangaVisibility");

const router = express.Router();

router.get("/lists", requireAuth, async (req, res) => {
  const listsResult = await pool.query(
    "SELECT id, title, description, is_private, created_at FROM manga_lists WHERE user_id = $1 ORDER BY created_at DESC",
    [req.user.id]
  );
  const lists = listsResult.rows;

  const visibility = visibilityFilter(req.user, 2);
  for (const list of lists) {
    const previewResult = await pool.query(
      `SELECT m.id, m.cover_path FROM manga_list_items mli
       JOIN manga m ON m.id = mli.manga_id
       WHERE mli.list_id = $1 AND ${visibility.clause}
       ORDER BY mli.added_at DESC LIMIT 6`,
      [list.id, ...visibility.params]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) AS count FROM manga_list_items mli
       JOIN manga m ON m.id = mli.manga_id
       WHERE mli.list_id = $1 AND ${visibility.clause}`,
      [list.id, ...visibility.params]
    );
    list.preview = previewResult.rows;
    list.manga_count = Number(countResult.rows[0].count);
  }

  res.json(lists);
});

router.get("/lists/:listId", optionalAuth, async (req, res) => {
  const { listId } = req.params;
  const listResult = await pool.query(
    `SELECT ml.*, u.username AS owner_username, u.display_name AS owner_display_name
     FROM manga_lists ml JOIN users u ON u.id = ml.user_id
     WHERE ml.id = $1`,
    [listId]
  );
  const list = listResult.rows[0];
  if (!list) return res.status(404).json({ error: "List not found" });

  const isOwner = req.user?.id === list.user_id;
  if (list.is_private && !isOwner && req.user?.role !== "admin") {
    return res.status(404).json({ error: "List not found" });
  }

  const visibility = visibilityFilter(req.user, 2);
  const itemsResult = await pool.query(
    `SELECT m.id, m.title, m.cover_path, m.is_private FROM manga_list_items mli
     JOIN manga m ON m.id = mli.manga_id
     WHERE mli.list_id = $1 AND ${visibility.clause}
     ORDER BY mli.added_at DESC`,
    [listId, ...visibility.params]
  );

  res.json({ ...list, manga: itemsResult.rows, is_owner: isOwner });
});

router.post("/lists", requireAuth, async (req, res) => {
  const { title, description, is_private } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const result = await pool.query(
    "INSERT INTO manga_lists (user_id, title, description, is_private) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.user.id, title.trim(), description || null, !!is_private]
  );
  res.status(201).json({ ...result.rows[0], manga_count: 0, preview: [] });
});

router.patch("/lists/:listId", requireAuth, async (req, res) => {
  const { listId } = req.params;
  const { title, description, is_private } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const result = await pool.query(
    "UPDATE manga_lists SET title = $1, description = $2, is_private = $3 WHERE id = $4 AND user_id = $5 RETURNING *",
    [title.trim(), description || null, !!is_private, listId, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "List not found" });
  res.json(result.rows[0]);
});

router.delete("/lists/:listId", requireAuth, async (req, res) => {
  const { listId } = req.params;
  const result = await pool.query("DELETE FROM manga_lists WHERE id = $1 AND user_id = $2 RETURNING id", [
    listId,
    req.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: "List not found" });
  res.json({ ok: true });
});

router.post("/lists/:listId/manga", requireAuth, async (req, res) => {
  const { listId } = req.params;
  const { mangaId } = req.body;
  if (!mangaId) return res.status(400).json({ error: "mangaId is required" });

  const listCheck = await pool.query("SELECT id FROM manga_lists WHERE id = $1 AND user_id = $2", [
    listId,
    req.user.id,
  ]);
  if (listCheck.rows.length === 0) return res.status(404).json({ error: "List not found" });

  const mangaCheck = await pool.query("SELECT id FROM manga WHERE id = $1", [mangaId]);
  if (mangaCheck.rows.length === 0) return res.status(404).json({ error: "Manga not found" });

  try {
    await pool.query("INSERT INTO manga_list_items (list_id, manga_id) VALUES ($1, $2)", [listId, mangaId]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Manga is already in this list" });
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.delete("/lists/:listId/manga/:mangaId", requireAuth, async (req, res) => {
  const { listId, mangaId } = req.params;
  const listCheck = await pool.query("SELECT id FROM manga_lists WHERE id = $1 AND user_id = $2", [
    listId,
    req.user.id,
  ]);
  if (listCheck.rows.length === 0) return res.status(404).json({ error: "List not found" });

  const result = await pool.query(
    "DELETE FROM manga_list_items WHERE list_id = $1 AND manga_id = $2 RETURNING manga_id",
    [listId, mangaId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Manga is not in this list" });
  res.json({ ok: true });
});

// Powers the "Add to Library" picker on the manga detail page: the current
// user's lists, each flagged with whether this particular manga is already
// in it, so the picker can render as a checklist.
router.get("/manga/:mangaId/lists", requireAuth, async (req, res) => {
  const { mangaId } = req.params;
  const result = await pool.query(
    `SELECT ml.id, ml.title,
            EXISTS (
              SELECT 1 FROM manga_list_items mli WHERE mli.list_id = ml.id AND mli.manga_id = $2
            ) AS has_manga
     FROM manga_lists ml
     WHERE ml.user_id = $1
     ORDER BY ml.created_at DESC`,
    [req.user.id, mangaId]
  );
  res.json(result.rows);
});

module.exports = router;

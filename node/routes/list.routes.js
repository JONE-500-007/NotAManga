const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { visibilityFilter } = require("../utils/mangaVisibility");
const { reorderRows } = require("../utils/reorder");
const { assertMaxLength, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } = require("../utils/validation");

const router = express.Router();

router.get("/lists", requireAuth, async (req, res) => {
  const listsResult = await pool.query(
    `SELECT id, title, description, is_private, show_on_profile, position, created_at
       FROM manga_lists WHERE user_id = $1
      ORDER BY position ASC NULLS LAST, created_at DESC`,
    [req.user.id]
  );
  const lists = listsResult.rows;

  const visibility = visibilityFilter(req.user, 2);
  for (const list of lists) {
    // Titles ride along with the covers so /library can label each preview
    // thumbnail instead of showing an anonymous grid of images.
    const previewResult = await pool.query(
      `SELECT m.id, m.title, m.cover_path FROM manga_list_items mli
       JOIN manga m ON m.id = mli.manga_id
       WHERE mli.list_id = $1 AND ${visibility.clause}
       ORDER BY mli.position ASC NULLS LAST, mli.added_at DESC LIMIT 6`,
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
     ORDER BY mli.position ASC NULLS LAST, mli.added_at DESC`,
    [listId, ...visibility.params]
  );

  res.json({ ...list, manga: itemsResult.rows, is_owner: isOwner });
});

router.post("/lists", requireAuth, async (req, res) => {
  const { title, description, is_private } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
  assertMaxLength(description, { label: "Description", max: MAX_DESCRIPTION_LENGTH });

  // New lists go to the front (position 1) and push the rest down, matching
  // where the old created_at DESC ordering used to put them.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM manga_lists WHERE user_id = $1 ORDER BY position ASC NULLS LAST, created_at DESC",
      [req.user.id]
    );
    // Inserted with a NULL position, then given its real one by reorderRows
    // below — NULLs don't collide under UNIQUE (user_id, position), so this
    // needs no temporary number of its own.
    const result = await client.query(
      `INSERT INTO manga_lists (user_id, title, description, is_private, position)
       VALUES ($1, $2, $3, $4, NULL) RETURNING *`,
      [req.user.id, title.trim(), description || null, !!is_private]
    );
    await reorderRows(client, {
      table: "manga_lists",
      numberColumn: "position",
      parentColumn: "user_id",
      parentId: req.user.id,
      orderedIds: [result.rows[0].id, ...existing.rows.map((r) => r.id)],
    });
    await client.query("COMMIT");
    res.status(201).json({ ...result.rows[0], position: 1, manga_count: 0, preview: [] });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// Must be declared before PATCH /lists/:listId, or "reorder" is captured as
// a listId by that route instead of reaching this one.
router.patch("/lists/reorder", requireAuth, async (req, res) => {
  const { orderedListIds } = req.body;
  if (!Array.isArray(orderedListIds) || orderedListIds.length === 0) {
    return res.status(400).json({ error: "orderedListIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Scoped by user_id: reorderRows only touches rows that are both in the
    // submitted list *and* owned by the caller, so ids belonging to someone
    // else's library are silently no-ops rather than reordering their lists.
    await reorderRows(client, {
      table: "manga_lists",
      numberColumn: "position",
      parentColumn: "user_id",
      parentId: req.user.id,
      orderedIds: orderedListIds,
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

router.patch("/lists/:listId", requireAuth, async (req, res) => {
  const { listId } = req.params;
  const { title, description, is_private, show_on_profile } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
  assertMaxLength(description, { label: "Description", max: MAX_DESCRIPTION_LENGTH });

  // A private list can't also be shown on the profile — the profile is
  // public, so honouring both would leak it. Private always wins.
  const isPrivate = !!is_private;
  const result = await pool.query(
    `UPDATE manga_lists SET title = $1, description = $2, is_private = $3,
            show_on_profile = COALESCE($4, show_on_profile) AND NOT $3, updated_at = NOW()
      WHERE id = $5 AND user_id = $6 RETURNING *`,
    [title.trim(), description || null, isPrivate, show_on_profile ?? null, listId, req.user.id]
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

  // New items go to the front, matching the old added_at DESC (newest-first)
  // default order — same reorderRows front-insert pattern as a new list
  // (POST /lists above). Not a bare "MIN(position) - 1": that drifts every
  // row's position negative one insert at a time, and reorderRows' own
  // parking step (-(i+1)) then collides with whatever's already sitting in
  // that negative range.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT manga_id FROM manga_list_items WHERE list_id = $1 ORDER BY position ASC NULLS LAST, added_at DESC",
      [listId]
    );
    await client.query("INSERT INTO manga_list_items (list_id, manga_id, position) VALUES ($1, $2, NULL)", [
      listId,
      mangaId,
    ]);
    await reorderRows(client, {
      table: "manga_list_items",
      numberColumn: "position",
      parentColumn: "list_id",
      parentId: listId,
      idColumn: "manga_id",
      orderedIds: [mangaId, ...existing.rows.map((r) => r.manga_id)],
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "Manga is already in this list" });
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json({ ok: true });
});

// Must be declared before DELETE /lists/:listId/manga/:mangaId, or "reorder"
// is captured as a mangaId by that route instead of reaching this one.
router.patch("/lists/:listId/manga/reorder", requireAuth, async (req, res) => {
  const { listId } = req.params;
  const { orderedMangaIds } = req.body;
  if (!Array.isArray(orderedMangaIds) || orderedMangaIds.length === 0) {
    return res.status(400).json({ error: "orderedMangaIds is required" });
  }

  const listCheck = await pool.query("SELECT id FROM manga_lists WHERE id = $1 AND user_id = $2", [
    listId,
    req.user.id,
  ]);
  if (listCheck.rows.length === 0) return res.status(404).json({ error: "List not found" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // idColumn: manga_list_items has no single-column id, but (list_id,
    // manga_id) is its real key — parentColumn already pins list_id, so
    // idColumn just needs to match rows by manga_id within that list.
    await reorderRows(client, {
      table: "manga_list_items",
      numberColumn: "position",
      parentColumn: "list_id",
      parentId: listId,
      idColumn: "manga_id",
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

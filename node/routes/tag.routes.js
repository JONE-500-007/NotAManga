const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { reorderRows } = require("../utils/reorder");
const { visibilityFilter } = require("../utils/mangaVisibility");

const router = express.Router();
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

router.get("/tags", optionalAuth, async (req, res) => {
  const result = await pool.query("SELECT id, name, color FROM tags ORDER BY position ASC");
  res.json(result.rows);
});

router.get("/tags/:tagId", optionalAuth, async (req, res) => {
  const { tagId } = req.params;
  const tagResult = await pool.query("SELECT id, name, color FROM tags WHERE id = $1", [tagId]);
  const tag = tagResult.rows[0];
  if (!tag) return res.status(404).json({ error: "Tag not found" });

  const visibility = visibilityFilter(req.user, 2);
  const mangaResult = await pool.query(
    `SELECT m.id, m.title, m.cover_path, m.is_private FROM manga_tags mt
     JOIN manga m ON m.id = mt.manga_id
     WHERE mt.tag_id = $1 AND ${visibility.clause} ORDER BY m.created_at DESC`,
    [tagId, ...visibility.params]
  );
  res.json({ ...tag, manga: mangaResult.rows });
});

router.post("/tags", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  if (color && !HEX_COLOR.test(color)) return res.status(400).json({ error: "Invalid color" });

  try {
    const maxResult = await pool.query("SELECT COALESCE(MAX(position), 0) AS max FROM tags");
    const position = Number(maxResult.rows[0].max) + 1;

    const result = await pool.query("INSERT INTO tags (name, color, position) VALUES ($1, $2, $3) RETURNING *", [
      name.trim(),
      color || null,
      position,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A tag with this name already exists" });
    throw err;
  }
});

router.patch("/tags/reorder", requireAuth, requireRole("admin"), async (req, res) => {
  const { orderedTagIds } = req.body;
  if (!Array.isArray(orderedTagIds) || orderedTagIds.length === 0) {
    return res.status(400).json({ error: "orderedTagIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reorderRows(client, {
      table: "tags",
      numberColumn: "position",
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
});

router.patch("/tags/:tagId", requireAuth, requireRole("admin"), async (req, res) => {
  const { tagId } = req.params;
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  if (color && !HEX_COLOR.test(color)) return res.status(400).json({ error: "Invalid color" });

  try {
    const result = await pool.query("UPDATE tags SET name = $1, color = $2 WHERE id = $3 RETURNING *", [
      name.trim(),
      color || null,
      tagId,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A tag with this name already exists" });
    throw err;
  }
});

router.delete("/tags/:tagId", requireAuth, requireRole("admin"), async (req, res) => {
  const { tagId } = req.params;
  const result = await pool.query("DELETE FROM tags WHERE id = $1 RETURNING id", [tagId]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Tag not found" });
  res.json({ ok: true });
});

module.exports = router;

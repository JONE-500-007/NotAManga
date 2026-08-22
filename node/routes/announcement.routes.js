const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");
const { reorderRows } = require("../utils/reorder");
const { assertMaxLength, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } = require("../utils/validation");

// Site-wide notices shown above the browse page's search box. Readable by
// anyone (they're announcements), writable only by admins — same split as
// the global tags and link-sites catalogs.
const router = express.Router();

router.get("/announcements", async (req, res) => {
  const result = await pool.query(
    "SELECT id, title, body, position FROM announcements ORDER BY position ASC, created_at DESC"
  );
  res.json(result.rows);
});

router.post("/announcements", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, body } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
  assertMaxLength(body, { label: "Body", max: MAX_DESCRIPTION_LENGTH });

  const maxResult = await pool.query("SELECT COALESCE(MAX(position), 0) AS max FROM announcements");
  const position = Number(maxResult.rows[0].max) + 1;

  const result = await pool.query(
    "INSERT INTO announcements (title, body, position) VALUES ($1, $2, $3) RETURNING id, title, body, position",
    [title.trim(), body || null, position]
  );
  res.status(201).json(result.rows[0]);
});

// Before PATCH /announcements/:id, or "reorder" is swallowed as an id.
router.patch("/announcements/reorder", requireAuth, requireRole("admin"), async (req, res) => {
  const { orderedAnnouncementIds } = req.body;
  if (!Array.isArray(orderedAnnouncementIds) || orderedAnnouncementIds.length === 0) {
    return res.status(400).json({ error: "orderedAnnouncementIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reorderRows(client, {
      table: "announcements",
      numberColumn: "position",
      orderedIds: orderedAnnouncementIds,
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

router.patch("/announcements/:announcementId", requireAuth, requireRole("admin"), async (req, res) => {
  const { announcementId } = req.params;
  const { title, body } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  assertMaxLength(title, { label: "Title", max: MAX_TITLE_LENGTH });
  assertMaxLength(body, { label: "Body", max: MAX_DESCRIPTION_LENGTH });

  const result = await pool.query(
    "UPDATE announcements SET title = $1, body = $2, updated_at = NOW() WHERE id = $3 RETURNING id, title, body, position",
    [title.trim(), body || null, announcementId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Announcement not found" });
  res.json(result.rows[0]);
});

router.delete("/announcements/:announcementId", requireAuth, requireRole("admin"), async (req, res) => {
  const { announcementId } = req.params;
  const result = await pool.query("DELETE FROM announcements WHERE id = $1 RETURNING id", [announcementId]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Announcement not found" });
  res.json({ ok: true });
});

module.exports = router;

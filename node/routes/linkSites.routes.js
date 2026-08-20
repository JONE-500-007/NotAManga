const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { linkSiteIconUpload, saveValidatedImage, LINK_SITE_ICONS_PREFIX } = require("../middleware/upload");
const { deleteUploadedFile } = require("../utils/fileStorage");
const { reorderRows } = require("../utils/reorder");
const { assertMaxLength, MAX_TITLE_LENGTH } = require("../utils/validation");
const { LINK_CATEGORIES } = require("../utils/mangaSites");

const router = express.Router();

// Public read (every visitor sees the Read-or-Buy/Track buttons); only
// admins manage the catalog itself, same split as the global tags list.
router.get("/link-sites", optionalAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, category, icon_path, position FROM link_sites ORDER BY category ASC, position ASC"
  );
  res.json(result.rows);
});

router.post(
  "/link-sites",
  requireAuth,
  requireRole("admin"),
  linkSiteIconUpload.single("icon"),
  async (req, res) => {
    const { name, category } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
    assertMaxLength(name, { label: "Name", max: MAX_TITLE_LENGTH });
    if (!LINK_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${LINK_CATEGORIES.join(", ")}` });
    }

    const iconPath = req.file ? await saveValidatedImage(req.file, LINK_SITE_ICONS_PREFIX) : null;

    const maxResult = await pool.query(
      "SELECT COALESCE(MAX(position), 0) AS max FROM link_sites WHERE category = $1",
      [category]
    );
    const position = Number(maxResult.rows[0].max) + 1;

    const result = await pool.query(
      "INSERT INTO link_sites (name, category, icon_path, position) VALUES ($1, $2, $3, $4) RETURNING *",
      [name.trim(), category, iconPath, position]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.patch(
  "/link-sites/reorder",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const { category, orderedSiteIds } = req.body;
    if (!LINK_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${LINK_CATEGORIES.join(", ")}` });
    }
    if (!Array.isArray(orderedSiteIds) || orderedSiteIds.length === 0) {
      return res.status(400).json({ error: "orderedSiteIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "link_sites",
        numberColumn: "position",
        parentColumn: "category",
        parentId: category,
        orderedIds: orderedSiteIds,
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
  "/link-sites/:siteId",
  requireAuth,
  requireRole("admin"),
  linkSiteIconUpload.single("icon"),
  async (req, res) => {
    const { siteId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
    assertMaxLength(name, { label: "Name", max: MAX_TITLE_LENGTH });

    if (req.file) {
      const existing = await pool.query("SELECT icon_path FROM link_sites WHERE id = $1", [siteId]);
      await deleteUploadedFile(existing.rows[0]?.icon_path);
    }
    const iconPath = req.file ? await saveValidatedImage(req.file, LINK_SITE_ICONS_PREFIX) : undefined;

    const result = await pool.query(
      "UPDATE link_sites SET name = $1, icon_path = COALESCE($2, icon_path) WHERE id = $3 RETURNING *",
      [name.trim(), iconPath || null, siteId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Site not found" });
    res.json(result.rows[0]);
  }
);

router.delete("/link-sites/:siteId", requireAuth, requireRole("admin"), async (req, res) => {
  const { siteId } = req.params;
  const result = await pool.query("DELETE FROM link_sites WHERE id = $1 RETURNING icon_path", [siteId]);
  const deleted = result.rows[0];
  if (!deleted) return res.status(404).json({ error: "Site not found" });
  await deleteUploadedFile(deleted.icon_path);
  res.json({ ok: true });
});

module.exports = router;

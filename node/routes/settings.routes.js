const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const CARD_SIZES = ["xs", "small", "medium", "large", "xl"];

router.get("/settings", optionalAuth, async (req, res) => {
  const result = await pool.query("SELECT all_manga_card_size FROM site_settings WHERE id = 1");
  res.json(result.rows[0]);
});

router.patch("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const { all_manga_card_size } = req.body;
  if (!CARD_SIZES.includes(all_manga_card_size)) {
    return res.status(400).json({ error: "Invalid all_manga_card_size" });
  }

  const result = await pool.query(
    "UPDATE site_settings SET all_manga_card_size = $1 WHERE id = 1 RETURNING all_manga_card_size",
    [all_manga_card_size]
  );
  res.json(result.rows[0]);
});

module.exports = router;

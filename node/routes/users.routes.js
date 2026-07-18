const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { avatarUpload, bannerUpload } = require("../middleware/upload");
const { deleteUploadedFile } = require("../utils/fileStorage");
const { SAFE_USER_COLUMNS, PUBLIC_USER_COLUMNS } = require("../utils/userColumns");

const router = express.Router();

router.get("/users/:userId", optionalAuth, async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const worksResult = await pool.query(
    "SELECT id, title, cover_path FROM manga WHERE uploader_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  res.json({ ...user, works: worksResult.rows });
});

router.patch("/users/me", requireAuth, async (req, res) => {
  const { display_name, bio, email } = req.body;

  const current = await pool.query("SELECT auth_provider, email FROM users WHERE id = $1", [req.user.id]);
  const existing = current.rows[0];
  if (!existing) return res.status(404).json({ error: "User not found" });

  const nextEmail = email || null;
  const emailChanged = (nextEmail || "").toLowerCase() !== (existing.email || "").toLowerCase();
  if (emailChanged && existing.auth_provider === "google") {
    return res.status(400).json({ error: "Email is managed by your Google account" });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET display_name = $1, bio = $2, email = $3,
              email_verified = CASE WHEN $5 THEN false ELSE email_verified END
       WHERE id = $4 RETURNING ${SAFE_USER_COLUMNS}`,
      [display_name || null, bio || null, nextEmail, req.user.id, emailChanged]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email is already in use" });
    throw err;
  }
});

router.post("/users/me/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "An image file is required" });

  const existing = await pool.query("SELECT avatar_path FROM users WHERE id = $1", [req.user.id]);
  await deleteUploadedFile(existing.rows[0]?.avatar_path);

  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  const result = await pool.query(
    `UPDATE users SET avatar_path = $1 WHERE id = $2 RETURNING ${SAFE_USER_COLUMNS}`,
    [avatarPath, req.user.id]
  );
  res.json(result.rows[0]);
});

router.post("/users/me/banner", requireAuth, bannerUpload.single("banner"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "An image file is required" });

  const existing = await pool.query("SELECT banner_path FROM users WHERE id = $1", [req.user.id]);
  await deleteUploadedFile(existing.rows[0]?.banner_path);

  const bannerPath = `/uploads/banners/${req.file.filename}`;
  const result = await pool.query(
    `UPDATE users SET banner_path = $1 WHERE id = $2 RETURNING ${SAFE_USER_COLUMNS}`,
    [bannerPath, req.user.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;

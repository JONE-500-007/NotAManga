const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { avatarUpload, bannerUpload } = require("../middleware/upload");
const { saveUserImage, AVATARS, BANNERS } = require("../utils/userStorage");
const { deleteUploadedFile } = require("../utils/fileStorage");
const { SAFE_USER_COLUMNS, PUBLIC_USER_COLUMNS } = require("../utils/userColumns");
const { visibilityFilter } = require("../utils/mangaVisibility");
const { reorderRows } = require("../utils/reorder");
const { assertMaxLength, MAX_DISPLAY_NAME_LENGTH, MAX_BIO_LENGTH } = require("../utils/validation");
const { recordProfileChanges } = require("../utils/profileEvents");

const router = express.Router();

router.get("/users/:userId", optionalAuth, async (req, res) => {
  const { userId } = req.params;
  const result = await pool.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const visibility = visibilityFilter(req.user, 2);
  // Same shape as the admin "All Manga" pins: a work the uploader pinned
  // floats to the front in the order they arranged, everything else keeps
  // the default newest-first.
  const worksResult = await pool.query(
    `SELECT id, title, cover_path, is_private, profile_pin_position FROM manga m
     WHERE uploader_id = $1 AND ${visibility.clause}
     ORDER BY profile_pin_position IS NULL ASC, profile_pin_position ASC, created_at DESC`,
    [userId, ...visibility.params]
  );

  // Only lists the owner opted into showing, and never a private one (the
  // DB already refuses that combination — see list.routes.js — but the
  // is_private check here keeps this correct even for rows predating it).
  const listsResult = await pool.query(
    `SELECT id, title, description FROM manga_lists
      WHERE user_id = $1 AND show_on_profile = true AND is_private = false
      ORDER BY position ASC NULLS LAST, created_at DESC`,
    [userId]
  );
  const lists = listsResult.rows;
  for (const list of lists) {
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

  res.json({ ...user, works: worksResult.rows, lists });
});

// Pinning a work to the uploader's own profile. Mirrors the admin
// /manga/:id/pin pair, but scoped to the caller's own uploads — an uploader
// arranges their profile, an admin arranges the front page.
router.patch("/users/me/works/:mangaId/pin", requireAuth, async (req, res) => {
  const { mangaId } = req.params;
  const maxResult = await pool.query(
    "SELECT COALESCE(MAX(profile_pin_position), 0) AS max FROM manga WHERE uploader_id = $1",
    [req.user.id]
  );
  const position = Number(maxResult.rows[0].max) + 1;

  const result = await pool.query(
    `UPDATE manga SET profile_pin_position = $1 WHERE id = $2 AND uploader_id = $3
     RETURNING id, title, cover_path, is_private, profile_pin_position`,
    [position, mangaId, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Work not found" });
  res.json(result.rows[0]);
});

router.delete("/users/me/works/:mangaId/pin", requireAuth, async (req, res) => {
  const { mangaId } = req.params;
  const result = await pool.query(
    "UPDATE manga SET profile_pin_position = NULL WHERE id = $1 AND uploader_id = $2 RETURNING id",
    [mangaId, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Work not found" });
  res.json({ ok: true });
});

router.patch("/users/me/works/reorder", requireAuth, async (req, res) => {
  const { orderedMangaIds } = req.body;
  if (!Array.isArray(orderedMangaIds) || orderedMangaIds.length === 0) {
    return res.status(400).json({ error: "orderedMangaIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // parentColumn scopes every UPDATE to the caller's own uploads, so an id
    // that isn't theirs matches no row instead of repinning someone else's.
    await reorderRows(client, {
      table: "manga",
      numberColumn: "profile_pin_position",
      parentColumn: "uploader_id",
      parentId: req.user.id,
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

router.patch("/users/me", requireAuth, async (req, res) => {
  const { display_name, bio, email } = req.body;
  assertMaxLength(display_name, { label: "Display name", max: MAX_DISPLAY_NAME_LENGTH });
  assertMaxLength(bio, { label: "Bio", max: MAX_BIO_LENGTH });

  const current = await pool.query(
    "SELECT auth_provider, email, display_name, bio FROM users WHERE id = $1",
    [req.user.id]
  );
  const existing = current.rows[0];
  if (!existing) return res.status(404).json({ error: "User not found" });

  const nextEmail = email || null;
  const emailChanged = (nextEmail || "").toLowerCase() !== (existing.email || "").toLowerCase();
  if (emailChanged && existing.auth_provider === "google") {
    return res.status(400).json({ error: "Email is managed by your Google account" });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET display_name = $1, bio = $2, email = $3, updated_at = NOW(),
              email_verified = CASE WHEN $5 THEN false ELSE email_verified END
       WHERE id = $4 RETURNING ${SAFE_USER_COLUMNS}`,
      [display_name || null, bio || null, nextEmail, req.user.id, emailChanged]
    );
    // After the update commits, so a failed/rejected edit never leaves a
    // history entry claiming a change that didn't happen.
    await recordProfileChanges(req.user.id, req.user.id, {
      display_name: { from: existing.display_name, to: display_name || null },
      bio: { from: existing.bio, to: bio || null },
      email: { from: existing.email, to: nextEmail },
    });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email is already in use" });
    throw err;
  }
});

router.post("/users/me/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "An image file is required" });

  // saveUserImage validates the upload (real magic-byte check) before ever
  // touching disk — that has to happen *before* the old file is deleted, or
  // a rejected re-upload (wrong file type, corrupt image, ...) leaves the
  // account with no avatar at all instead of keeping the one it had.
  const avatarPath = await saveUserImage(req.file, req.user.id, AVATARS);

  const existing = await pool.query("SELECT avatar_path FROM users WHERE id = $1", [req.user.id]);
  const result = await pool.query(
    `UPDATE users SET avatar_path = $1, updated_at = NOW() WHERE id = $2 RETURNING ${SAFE_USER_COLUMNS}`,
    [avatarPath, req.user.id]
  );
  await recordProfileChanges(req.user.id, req.user.id, {
    avatar_path: { from: existing.rows[0]?.avatar_path, to: avatarPath },
  });
  await deleteUploadedFile(existing.rows[0]?.avatar_path);
  res.json(result.rows[0]);
});

router.post("/users/me/banner", requireAuth, bannerUpload.single("banner"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "An image file is required" });

  // See the avatar route above — validate/save the new file before deleting
  // the old one, not after.
  const bannerPath = await saveUserImage(req.file, req.user.id, BANNERS);

  const existing = await pool.query("SELECT banner_path FROM users WHERE id = $1", [req.user.id]);
  const result = await pool.query(
    `UPDATE users SET banner_path = $1, updated_at = NOW() WHERE id = $2 RETURNING ${SAFE_USER_COLUMNS}`,
    [bannerPath, req.user.id]
  );
  await recordProfileChanges(req.user.id, req.user.id, {
    banner_path: { from: existing.rows[0]?.banner_path, to: bannerPath },
  });
  await deleteUploadedFile(existing.rows[0]?.banner_path);
  res.json(result.rows[0]);
});

module.exports = router;

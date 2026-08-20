const express = require("express");
const pool = require("../db/pool");
const { optionalAuth } = require("../middleware/auth");
const { canViewManga } = require("../utils/mangaVisibility");
const { getPresignedGetUrl } = require("../utils/r2Client");

// Everything under uploads/manga/<id>/... and uploads/novel/<id>/... belongs
// to a specific work and has to respect that work's privacy the same way the
// JSON API does (is_private / manga_visible_roles / uploader / admin) — the
// R2 bucket is private, so nothing is fetchable at all without going through
// this check first and getting a short-lived signed URL back.
//
// Everything else under uploads/ (avatars, banners, link site icons) carries
// no privacy concept, so it skips straight to signing — same bucket, just no
// visibility check first.
const router = express.Router();

// RegExp routes (rather than Express path-pattern strings) sidestep
// path-to-regexp's wildcard/custom-regex syntax entirely, so these don't
// need to track which syntax the installed Express major version expects.
const UPLOAD_WORK_PATH = /^\/uploads\/(manga|novel)\/(\d+)\/(.+)$/;
const UPLOAD_PUBLIC_PATH = /^\/uploads\/(users|link-site-icons)\/(.+)$/;

router.get(UPLOAD_WORK_PATH, optionalAuth, async (req, res) => {
  const match = req.path.match(UPLOAD_WORK_PATH);
  const [, workType, mangaId, relPath] = match;

  const mangaResult = await pool.query(
    "SELECT id, uploader_id, is_private FROM manga WHERE id = $1 AND work_type = $2",
    [mangaId, workType]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return res.status(404).end();

  // canViewManga returns true immediately for a public manga without ever
  // looking at visibleRoles, so the extra query below only runs for the
  // is_private=true minority — the common case (reading a public chapter)
  // costs exactly one indexed lookup, same as before this route existed.
  const visibleRoles = manga.is_private
    ? (await pool.query("SELECT role FROM manga_visible_roles WHERE manga_id = $1", [mangaId])).rows.map(
        (r) => r.role
      )
    : [];

  if (!canViewManga(req.user, manga, visibleRoles)) return res.status(404).end();

  const url = await getPresignedGetUrl(`${workType}/${mangaId}/${relPath}`);
  res.redirect(url);
});

router.get(UPLOAD_PUBLIC_PATH, async (req, res) => {
  const match = req.path.match(UPLOAD_PUBLIC_PATH);
  const [, kind, relPath] = match;
  const url = await getPresignedGetUrl(`${kind}/${relPath}`);
  res.redirect(url);
});

module.exports = router;

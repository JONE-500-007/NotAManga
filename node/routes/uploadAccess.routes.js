const express = require("express");
const pool = require("../db/pool");
const { optionalAuth } = require("../middleware/auth");
const { canViewManga } = require("../utils/mangaVisibility");
const { mangaDir } = require("../utils/mangaStorage");

// Everything under uploads/manga/<id>/... and uploads/novel/<id>/... belongs
// to a specific work and has to respect that work's privacy the same way the
// JSON API does (is_private / manga_visible_roles / uploader / admin) — a
// bare express.static mount can't do that, it has no concept of "this file
// belongs to a manga the requester isn't allowed to see". Without this route
// intercepting those paths first, a private or admin-banned manga's page
// images stay fetchable by anyone who ever saw the URL, forever, regardless
// of what the manga's visibility says.
//
// Everything else under uploads/ (avatars, banners, defaults, link site
// icons) carries no privacy concept and keeps using the plain
// express.static mount in server.js — this router only needs to claim the
// two prefixes that do.
const router = express.Router();

// A RegExp route (rather than an Express path-pattern string) sidesteps
// path-to-regexp's wildcard/custom-regex syntax entirely, so this doesn't
// need to track which syntax the installed Express major version expects.
const UPLOAD_WORK_PATH = /^\/uploads\/(manga|novel)\/(\d+)\/(.+)$/;

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

  // sendFile's `root` option resolves relPath against it and refuses to
  // serve anything that would land outside that directory — defense in
  // depth on top of the /(.+)$/ capture above already having come from a
  // known-numeric, DB-verified manga id.
  res.sendFile(relPath, { root: mangaDir(workType, mangaId) }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

module.exports = router;

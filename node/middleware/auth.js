const { verify, sign, COOKIE_OPTIONS } = require("../utils/jwt");
const pool = require("../db/pool");

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    req.user = verify(token);
    // Sliding session: every authenticated request extends the cookie's
    // expiry, so active users stay logged in and idle ones time out.
    res.cookie("token", sign(req.user), COOKIE_OPTIONS);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Used on read-only routes that should work for anonymous visitors but still
// personalize the response (e.g. isOwner checks) when a valid session cookie
// is present. Unlike requireAuth, a missing/invalid/expired token is not an
// error here — it just leaves req.user unset.
function optionalAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return next();

  try {
    req.user = verify(token);
    res.cookie("token", sign(req.user), COOKIE_OPTIONS);
  } catch {
    // Invalid/expired token on a public route: proceed unauthenticated.
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

async function requireMangaOwner(req, res, next) {
  const { mangaId } = req.params;
  const result = await pool.query("SELECT uploader_id FROM manga WHERE id = $1", [mangaId]);
  const manga = result.rows[0];
  if (!manga) return res.status(404).json({ error: "Manga not found" });
  if (req.user.role !== "admin" && manga.uploader_id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireRole, requireMangaOwner };

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

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
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
  if (manga.uploader_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  next();
}

module.exports = { requireAuth, requireRole, requireMangaOwner };

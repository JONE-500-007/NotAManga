const jwt = require("jsonwebtoken");
const { JWT_SECRET: SECRET } = require("./secrets");

// Sliding idle timeout: a session is valid for this long since the *last*
// authenticated request. requireAuth reissues the token/cookie on every
// request, so active use keeps extending it; inactivity lets it expire.
const SESSION_DURATION_SECONDS = 4 * 60 * 60; // 4 hours

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  // Only marked Secure in production so the cookie still works over plain
  // HTTP in local dev; the deployed site is HTTPS-only via Cloudflare (see
  // docker-compose.prod.yml's NODE_ENV=production).
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_DURATION_SECONDS * 1000,
};

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: SESSION_DURATION_SECONDS }
  );
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify, SESSION_DURATION_SECONDS, COOKIE_OPTIONS };

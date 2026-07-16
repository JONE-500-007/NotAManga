const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

// Sliding idle timeout: a session is valid for this long since the *last*
// authenticated request. requireAuth reissues the token/cookie on every
// request, so active use keeps extending it; inactivity lets it expire.
const SESSION_DURATION_SECONDS = 4 * 60 * 60; // 4 hours

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
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

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

// HS256 is fixed on both ends rather than left for jsonwebtoken to infer.
// The installed version already rejects "alg: none" by default, but pinning
// it here means verify() can never be tricked into accepting a token signed
// with a different algorithm than sign() actually uses, on this version or
// any future one.
const ALGORITHM = "HS256";

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: SESSION_DURATION_SECONDS, algorithm: ALGORITHM }
  );
}

function verify(token) {
  return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { sign, verify, SESSION_DURATION_SECONDS, COOKIE_OPTIONS };

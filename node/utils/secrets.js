// JWT_SECRET signs both session tokens (utils/jwt.js) and one-shot action
// tokens (utils/actionToken.js — email verification, password reset).
// Failing loudly at boot if it's missing is deliberate: silently falling
// back to a hardcoded string would let anyone forge a valid session (or an
// admin session, or a password-reset token for any account) the moment a
// deploy ever forgets to set this.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

module.exports = { JWT_SECRET };

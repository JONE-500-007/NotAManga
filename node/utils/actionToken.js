const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

// Stateless tokens for one-shot email actions (verify-email, reset-password)
// signed with the same secret as session tokens but a distinct "purpose"
// claim, so no separate token table/expiry-tracking is needed. For
// reset-password, callers embed a fingerprint of the current password_hash
// so a token is automatically invalidated the moment the password changes
// (see auth.routes.js) — that's the only revocation reset-password needs.
function signActionToken(payload, expiresIn) {
  return jwt.sign(payload, SECRET, { expiresIn });
}

function verifyActionToken(token, purpose) {
  const decoded = jwt.verify(token, SECRET);
  if (decoded.purpose !== purpose) throw new Error("Token purpose mismatch");
  return decoded;
}

module.exports = { signActionToken, verifyActionToken };

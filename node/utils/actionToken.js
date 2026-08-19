const jwt = require("jsonwebtoken");
const { JWT_SECRET: SECRET } = require("./secrets");

// Stateless tokens for one-shot email actions (verify-email, reset-password)
// signed with the same secret as session tokens but a distinct "purpose"
// claim, so no separate token table/expiry-tracking is needed. For
// reset-password, callers embed a fingerprint of the current password_hash
// so a token is automatically invalidated the moment the password changes
// (see auth.routes.js) — that's the only revocation reset-password needs.
// Pinned for the same reason as utils/jwt.js's session tokens: verify()
// should never accept a token signed with anything other than what sign()
// actually uses.
const ALGORITHM = "HS256";

function signActionToken(payload, expiresIn) {
  return jwt.sign(payload, SECRET, { expiresIn, algorithm: ALGORITHM });
}

function verifyActionToken(token, purpose) {
  const decoded = jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
  if (decoded.purpose !== purpose) throw new Error("Token purpose mismatch");
  return decoded;
}

module.exports = { signActionToken, verifyActionToken };

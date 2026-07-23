const rateLimit = require("express-rate-limit");

// Applied per-IP to the auth endpoints that are reachable without a session
// and either check a secret (login) or trigger an outbound email
// (register/forgot-password/send-verification). Without this an attacker
// can brute-force passwords, or repeatedly spam a victim's inbox / burn
// through the Resend quota, at unlimited speed.
function makeLimiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
}

const loginLimiter = makeLimiter(15 * 60 * 1000, 10);
const registerLimiter = makeLimiter(60 * 60 * 1000, 10);
const forgotPasswordLimiter = makeLimiter(15 * 60 * 1000, 5);
const sendVerificationLimiter = makeLimiter(15 * 60 * 1000, 5);

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter, sendVerificationLimiter };

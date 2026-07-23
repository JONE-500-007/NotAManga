const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { sign, COOKIE_OPTIONS } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter, registerLimiter, forgotPasswordLimiter, sendVerificationLimiter } = require("../middleware/rateLimit");
const { SAFE_USER_COLUMNS } = require("../utils/userColumns");
const { signActionToken, verifyActionToken } = require("../utils/actionToken");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 5 * 60 * 1000,
};

async function generateUniqueUsername(base) {
  const cleanBase = base.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
  let candidate = cleanBase;
  let suffix = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [candidate]);
    if (existing.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${cleanBase}${suffix}`;
  }
}

router.post("/login", loginLimiter, async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email and password are required" });
  }

  const result = await pool.query(
    "SELECT * FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)",
    [identifier]
  );
  const user = result.rows[0];
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: "Invalid username/email or password" });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username/email or password" });
  }

  const token = sign(user);
  res.cookie("token", token, COOKIE_OPTIONS);
  const safe = await pool.query(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`, [user.id]);
  res.json(safe.rows[0]);
});

router.post("/register", registerLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, auth_provider)
       VALUES ($1, $2, $3, 'member', 'local') RETURNING ${SAFE_USER_COLUMNS}`,
      [username, email, passwordHash]
    );
    const user = result.rows[0];
    res.cookie("token", sign(user), COOKIE_OPTIONS);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That username or email is already taken" });
    }
    throw err;
  }
});

router.post("/logout", requireAuth, (req, res) => {
  // clearCookie must be called with the same attributes the cookie was set
  // with (secure/sameSite in particular), or some browsers won't drop it.
  res.clearCookie("token", COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`, [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

router.get("/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ error: "Google sign-in is not configured" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, OAUTH_STATE_COOKIE_OPTIONS);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.cookies.oauth_state;
  res.clearCookie("oauth_state", OAUTH_STATE_COOKIE_OPTIONS);

  if (!code || !state || state !== expectedState) {
    return res.redirect(`${FRONTEND_URL}/login?error=google`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("Google token exchange failed");
    const tokenData = await tokenRes.json();

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userInfoRes.ok) throw new Error("Google userinfo fetch failed");
    const googleUser = await userInfoRes.json();

    let result = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleUser.sub]);
    let user = result.rows[0];

    if (!user && googleUser.email) {
      result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [googleUser.email]);
      user = result.rows[0];
      if (user) {
        // Link the Google identity to the existing local account without
        // touching auth_provider, so they keep password login + email edits.
        // Google already confirmed this email belongs to them, so mark it
        // verified too.
        const updated = await pool.query(
          "UPDATE users SET google_id = $1, email_verified = true WHERE id = $2 RETURNING *",
          [googleUser.sub, user.id]
        );
        user = updated.rows[0];
      }
    }

    if (!user) {
      const username = await generateUniqueUsername(googleUser.name || googleUser.email.split("@")[0]);
      const inserted = await pool.query(
        `INSERT INTO users (username, email, display_name, google_id, role, auth_provider, email_verified)
         VALUES ($1, $2, $3, $4, 'member', 'google', $5) RETURNING *`,
        [username, googleUser.email || null, googleUser.name || null, googleUser.sub, googleUser.email_verified === true]
      );
      user = inserted.rows[0];
    }

    res.cookie("token", sign(user), COOKIE_OPTIONS);
    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    res.redirect(`${FRONTEND_URL}/login?error=google`);
  }
});

function passwordFingerprint(passwordHash) {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

router.post("/send-verification", requireAuth, sendVerificationLimiter, async (req, res) => {
  const result = await pool.query("SELECT auth_provider, email, email_verified FROM users WHERE id = $1", [
    req.user.id,
  ]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.auth_provider === "google") {
    return res.status(400).json({ error: "Google accounts don't need email verification" });
  }
  if (!user.email) return res.status(400).json({ error: "Add an email address to your profile first" });
  if (user.email_verified) return res.status(400).json({ error: "Email is already verified" });

  const token = signActionToken({ purpose: "verify-email", userId: req.user.id, email: user.email }, "1h");
  await sendVerificationEmail(user.email, `${FRONTEND_URL}/verify-email?token=${token}`);
  res.json({ ok: true });
});

router.post("/verify-email", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    const decoded = verifyActionToken(token, "verify-email");
    const result = await pool.query("SELECT email FROM users WHERE id = $1", [decoded.userId]);
    const user = result.rows[0];
    if (!user || (user.email || "").toLowerCase() !== (decoded.email || "").toLowerCase()) {
      return res.status(400).json({ error: "This verification link is no longer valid" });
    }
    await pool.query("UPDATE users SET email_verified = true WHERE id = $1", [decoded.userId]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "This verification link is invalid or has expired" });
  }
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: "Username or email is required" });

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)",
    [identifier]
  );
  const user = result.rows[0];

  // Always respond the same way regardless of whether an account matched,
  // so this endpoint can't be used to enumerate registered emails/usernames.
  if (user && user.password_hash && user.email) {
    const token = signActionToken(
      { purpose: "reset-password", userId: user.id, pw: passwordFingerprint(user.password_hash) },
      "30m"
    );
    await sendPasswordResetEmail(user.email, `${FRONTEND_URL}/reset-password?token=${token}`);
  }
  res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const decoded = verifyActionToken(token, "reset-password");
    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [decoded.userId]);
    const user = result.rows[0];
    if (!user || !user.password_hash || passwordFingerprint(user.password_hash) !== decoded.pw) {
      return res.status(400).json({ error: "This reset link is no longer valid" });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, decoded.userId]);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "This reset link is invalid or has expired" });
  }
});

module.exports = router;

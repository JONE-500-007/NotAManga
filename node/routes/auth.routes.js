const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { sign } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = sign(user);
  res.cookie("token", token, COOKIE_OPTIONS);
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post("/logout", requireAuth, (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;

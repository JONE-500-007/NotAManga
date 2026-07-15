const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

function sign(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: "7d" }
  );
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify };

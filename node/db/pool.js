const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "justthisuser",
  host: process.env.DB_HOST || "db",
  database: process.env.DB_NAME || "my_database",
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

module.exports = pool;
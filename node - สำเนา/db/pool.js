const { Pool } = require("pg");

const pool = new Pool({
  user: "justthisuser",
  host: "db",
  database: "my_database",
  password: "mysqlpass1122",
  port: 5432,
});

module.exports = pool;

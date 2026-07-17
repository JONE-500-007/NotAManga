const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const pool = require("./db/pool");
const { initSchema } = require("./db/schema");
const authRoutes = require("./routes/auth.routes");
const mangaRoutes = require("./routes/manga.routes");
const categoryRoutes = require("./routes/category.routes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows);
});

app.use("/api/auth", authRoutes);
app.use("/api", mangaRoutes);
app.use("/api", categoryRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

initSchema(pool)
  .then(() => {
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((err) => {
    console.error("Failed to initialize schema", err);
    process.exit(1);
  });

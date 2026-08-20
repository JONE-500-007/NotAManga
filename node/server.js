const express = require("express");
const cookieParser = require("cookie-parser");
const pool = require("./db/pool");
const { initSchema } = require("./db/schema");
const authRoutes = require("./routes/auth.routes");
const mangaRoutes = require("./routes/manga.routes");
const categoryRoutes = require("./routes/category.routes");
const usersRoutes = require("./routes/users.routes");
const settingsRoutes = require("./routes/settings.routes");
const tagRoutes = require("./routes/tag.routes");
const listRoutes = require("./routes/list.routes");
const adminRoutes = require("./routes/admin.routes");
const linkSitesRoutes = require("./routes/linkSites.routes");
const announcementRoutes = require("./routes/announcement.routes");
const linkPreviewRoutes = require("./routes/linkPreview.routes");
const sitemapRoutes = require("./routes/sitemap.routes");
const uploadAccessRoutes = require("./routes/uploadAccess.routes");
const { toFriendlyError } = require("./utils/friendlyError");

const app = express();
// Exactly one reverse proxy sits in front of this app (nginx — see
// react/nginx.conf's /api/ block, which sets X-Forwarded-For). Trusting
// precisely 1 hop (not `true`, which trusts the whole chain including
// headers a client could forge) is what lets express-rate-limit and
// req.ip key off the real visitor instead of nginx's own address.
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
// Handles every /uploads/... path — manga/novel (privacy-checked) and
// everything else (avatars, banners, link site icons, static UI icons,
// shipped defaults — no privacy concept) — by redirecting to a short-lived
// signed R2 URL. See uploadAccess.routes.js.
app.use(uploadAccessRoutes);

app.get("/", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows);
});

app.use("/api/auth", authRoutes);
app.use("/api", mangaRoutes);
app.use("/api", categoryRoutes);
app.use("/api", usersRoutes);
app.use("/api", settingsRoutes);
app.use("/api", tagRoutes);
app.use("/api", listRoutes);
app.use("/api", adminRoutes);
app.use("/api", linkSitesRoutes);
app.use("/api", announcementRoutes);
// Bare (non-/api) paths matching the public share URLs — nginx only routes
// known bot user-agents here in production; see linkPreview.routes.js.
app.use("/", linkPreviewRoutes);
app.use("/", sitemapRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const { status, message } = toFriendlyError(err);
  res.status(status).json({ error: message });
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

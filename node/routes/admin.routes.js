const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// One query template per bucket size — the unit is always taken from this
// fixed whitelist (never interpolated from request input directly), so
// there's no dynamic-SQL injection surface despite the string building.
const SERIES_UNITS = {
  day: { genStart: "CURRENT_DATE - make_interval(days => $1::int - 1)", genEnd: "CURRENT_DATE", step: "1 day", bucketExpr: "DATE(ve.viewed_at)", defaultCount: 60, maxCount: 180 },
  week: { genStart: "date_trunc('week', CURRENT_DATE) - make_interval(weeks => $1::int - 1)", genEnd: "date_trunc('week', CURRENT_DATE)", step: "1 week", bucketExpr: "date_trunc('week', ve.viewed_at)", defaultCount: 26, maxCount: 104 },
  month: { genStart: "date_trunc('month', CURRENT_DATE) - make_interval(months => $1::int - 1)", genEnd: "date_trunc('month', CURRENT_DATE)", step: "1 month", bucketExpr: "date_trunc('month', ve.viewed_at)", defaultCount: 12, maxCount: 36 },
};

// Builds one row per day/week/month over the trailing window (via
// generate_series, so quiet buckets show up as 0 instead of a gap in the
// line) with a view_events count for that bucket — optionally scoped to a
// single manga.
async function viewSeries(mangaId, unitParam, countParam) {
  const unit = SERIES_UNITS[unitParam] ? unitParam : "day";
  const { genStart, genEnd, step, bucketExpr, defaultCount, maxCount } = SERIES_UNITS[unit];
  const count = Math.min(Math.max(Number(countParam) || defaultCount, 2), maxCount);

  const params = mangaId ? [count, mangaId] : [count];
  const mangaFilter = mangaId ? "AND ve.manga_id = $2" : "";
  const result = await pool.query(
    `SELECT to_char(d.bucket, 'YYYY-MM-DD') AS date, COUNT(ve.id) AS views
     FROM generate_series(${genStart}, ${genEnd}, interval '${step}') AS d(bucket)
     LEFT JOIN view_events ve ON ${bucketExpr} = d.bucket ${mangaFilter}
     GROUP BY d.bucket
     ORDER BY d.bucket ASC`,
    params
  );
  return result.rows.map((r) => ({ date: r.date, views: Number(r.views) }));
}

router.get("/admin/stats/trend", requireAuth, requireRole("admin"), async (req, res) => {
  const series = await viewSeries(null, req.query.unit, req.query.count);
  res.json(series);
});

router.get("/admin/stats/search", requireAuth, requireRole("admin"), async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const result = await pool.query(
    `SELECT id, title, work_type, view_count, cover_path FROM manga
     WHERE title ILIKE $1 ORDER BY view_count DESC LIMIT 20`,
    [`%${q}%`]
  );
  res.json(result.rows.map((m) => ({ ...m, view_count: Number(m.view_count) })));
});

router.get("/admin/stats", requireAuth, requireRole("admin"), async (req, res) => {
  const workTypeCounts = await pool.query("SELECT work_type, COUNT(*) AS count FROM manga GROUP BY work_type");
  let totalManga = 0;
  let totalNovels = 0;
  for (const row of workTypeCounts.rows) {
    if (row.work_type === "novel") totalNovels = Number(row.count);
    else totalManga += Number(row.count);
  }

  const totalsResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM categories) AS total_categories,
      (SELECT COUNT(*) FROM tags) AS total_tags,
      (SELECT COUNT(*) FROM chapters) AS total_chapters,
      (SELECT COUNT(*) FROM manga_lists) AS total_lists,
      (SELECT COALESCE(SUM(view_count), 0) FROM manga) AS total_views
  `);
  const totals = totalsResult.rows[0];

  const topMangaResult = await pool.query(
    `SELECT m.id, m.title, m.work_type, m.cover_path, m.view_count, u.username AS uploader_username
     FROM manga m JOIN users u ON u.id = m.uploader_id
     ORDER BY m.view_count DESC LIMIT 10`
  );

  const topCategoriesResult = await pool.query(`
    SELECT c.id, c.title, COALESCE(SUM(m.view_count), 0) AS total_views
    FROM categories c
    LEFT JOIN category_manga cm ON cm.category_id = c.id
    LEFT JOIN manga m ON m.id = cm.manga_id
    GROUP BY c.id, c.title
    ORDER BY total_views DESC
    LIMIT 5
  `);

  const recentUploadsResult = await pool.query(
    `SELECT m.id, m.title, m.work_type, m.created_at, u.username AS uploader_username
     FROM manga m JOIN users u ON u.id = m.uploader_id
     ORDER BY m.created_at DESC LIMIT 10`
  );

  const recentUsersResult = await pool.query(
    "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC LIMIT 10"
  );

  const roleBreakdownResult = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC"
  );

  res.json({
    total_manga: totalManga,
    total_novels: totalNovels,
    total_users: Number(totals.total_users),
    total_categories: Number(totals.total_categories),
    total_tags: Number(totals.total_tags),
    total_chapters: Number(totals.total_chapters),
    total_lists: Number(totals.total_lists),
    total_views: Number(totals.total_views),
    top_manga: topMangaResult.rows.map((m) => ({ ...m, view_count: Number(m.view_count) })),
    top_categories: topCategoriesResult.rows.map((c) => ({ ...c, total_views: Number(c.total_views) })),
    recent_uploads: recentUploadsResult.rows,
    recent_users: recentUsersResult.rows,
    role_breakdown: roleBreakdownResult.rows.map((r) => ({ role: r.role, count: Number(r.count) })),
  });
});

router.get("/admin/stats/manga/:mangaId/trend", requireAuth, requireRole("admin"), async (req, res) => {
  const { mangaId } = req.params;
  const series = await viewSeries(mangaId, req.query.unit, req.query.count);
  res.json(series);
});

router.get("/admin/stats/manga/:mangaId", requireAuth, requireRole("admin"), async (req, res) => {
  const { mangaId } = req.params;

  const mangaResult = await pool.query(
    `SELECT m.id, m.title, m.work_type, m.view_count, m.created_at, m.cover_path,
            u.username AS uploader_username, u.display_name AS uploader_display_name
     FROM manga m JOIN users u ON u.id = m.uploader_id
     WHERE m.id = $1`,
    [mangaId]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return res.status(404).json({ error: "Manga not found" });

  const ratingResult = await pool.query(
    "SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*) AS count FROM manga_ratings WHERE manga_id = $1",
    [mangaId]
  );

  const chaptersResult = await pool.query(
    "SELECT id, chapter_number, volume, title, view_count, created_at FROM chapters WHERE manga_id = $1 ORDER BY chapter_number ASC",
    [mangaId]
  );
  const chapters = chaptersResult.rows.map((c) => ({ ...c, view_count: Number(c.view_count) }));
  const mostViewedChapter = chapters.reduce(
    (top, c) => (!top || c.view_count > top.view_count ? c : top),
    null
  );

  res.json({
    ...manga,
    rating_average: Number(ratingResult.rows[0].average),
    rating_count: Number(ratingResult.rows[0].count),
    chapters,
    most_viewed_chapter: mostViewedChapter,
  });
});

module.exports = router;

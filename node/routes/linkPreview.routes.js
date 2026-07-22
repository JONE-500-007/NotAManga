const express = require("express");
const pool = require("../db/pool");
const { canViewManga } = require("../utils/mangaVisibility");

// Link-unfurling bots (Discord, Facebook, Twitter/X, Slack, LINE, ...) fetch
// a shared URL and parse its raw HTML for Open Graph tags — they don't run
// JavaScript, so the React app's own <title>/meta updates are invisible to
// them. nginx routes just these bots' requests to /manga/:id here instead of
// the SPA's static index.html (see react/nginx.conf); everyone else keeps
// getting the normal React app, completely unaffected by this route.
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SITE_NAME = "NotAManga";
const DEFAULT_DESCRIPTION = "Read manga and light novels online.";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Titles/descriptions are authored as markdown (+ the occasional raw color
// <span>, see EditMangaPage's color tool) for on-site rendering. A meta tag
// is plain text, so this strips both down to just the words a reader would
// see — not a full markdown parser, just enough for a clean preview card.
function stripFormatting(text) {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function renderMetaPage({ title, description, image, url, type }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = image ? escapeHtml(image) : "";
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeUrl}">
${safeImage ? `<meta property="og:image" content="${safeImage}">\n` : ""}<meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
${safeImage ? `<meta name="twitter:image" content="${safeImage}">\n` : ""}</head>
<body>
<p><a href="${safeUrl}">${safeTitle}</a></p>
<p>${safeDescription}</p>
</body>
</html>
`;
}

function fallbackPage(res, url, status = 200) {
  res
    .status(status)
    .type("html")
    .send(
      renderMetaPage({
        title: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        image: null,
        url,
        type: "website",
      })
    );
}

router.get("/manga/:mangaId", async (req, res) => {
  const { mangaId } = req.params;
  const url = `${FRONTEND_URL}/manga/${mangaId}`;

  const mangaResult = await pool.query(
    "SELECT id, title, description, cover_path, is_private, uploader_id FROM manga WHERE id = $1",
    [mangaId]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return fallbackPage(res, url, 404);

  const visibleRolesResult = await pool.query(
    "SELECT role FROM manga_visible_roles WHERE manga_id = $1",
    [mangaId]
  );
  if (!canViewManga(null, manga, visibleRolesResult.rows.map((r) => r.role))) {
    return fallbackPage(res, url);
  }

  res.type("html").send(
    renderMetaPage({
      title: stripFormatting(manga.title) || SITE_NAME,
      description: truncate(stripFormatting(manga.description) || DEFAULT_DESCRIPTION, 200),
      image: manga.cover_path ? `${FRONTEND_URL}${manga.cover_path}` : null,
      url,
      type: "website",
    })
  );
});

router.get("/manga/:mangaId/chapter/:chapterId", async (req, res) => {
  const { mangaId, chapterId } = req.params;
  const url = `${FRONTEND_URL}/manga/${mangaId}/chapter/${chapterId}`;

  const mangaResult = await pool.query(
    "SELECT id, title, description, cover_path, is_private, uploader_id FROM manga WHERE id = $1",
    [mangaId]
  );
  const manga = mangaResult.rows[0];
  if (!manga) return fallbackPage(res, url, 404);

  const visibleRolesResult = await pool.query(
    "SELECT role FROM manga_visible_roles WHERE manga_id = $1",
    [mangaId]
  );
  if (!canViewManga(null, manga, visibleRolesResult.rows.map((r) => r.role))) {
    return fallbackPage(res, url);
  }

  const chapterResult = await pool.query(
    "SELECT chapter_number, title FROM chapters WHERE id = $1 AND manga_id = $2",
    [chapterId, mangaId]
  );
  const chapter = chapterResult.rows[0];
  const mangaTitle = stripFormatting(manga.title) || SITE_NAME;
  const title = chapter
    ? `${mangaTitle} - Ch. ${chapter.chapter_number}${chapter.title ? `: ${stripFormatting(chapter.title)}` : ""}`
    : mangaTitle;

  res.type("html").send(
    renderMetaPage({
      title,
      description: truncate(stripFormatting(manga.description) || DEFAULT_DESCRIPTION, 200),
      image: manga.cover_path ? `${FRONTEND_URL}${manga.cover_path}` : null,
      url,
      type: "article",
    })
  );
});

module.exports = router;

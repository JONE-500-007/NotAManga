const express = require("express");
const pool = require("../db/pool");

// Search engines that DO render JS (Googlebot et al.) still get the plain
// SPA for every page (see react/nginx.conf), so this is the only place they
// learn which /manga/:id and /tags/:id URLs exist at all — nothing links
// them from a crawlable static page otherwise.
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

router.get("/sitemap.xml", async (req, res) => {
  const [mangaResult, tagsResult] = await Promise.all([
    pool.query("SELECT id, created_at FROM manga WHERE is_private = false ORDER BY id"),
    pool.query("SELECT id FROM tags ORDER BY id"),
  ]);

  const entries = [
    urlEntry({ loc: `${FRONTEND_URL}/`, changefreq: "daily", priority: "1.0" }),
    ...mangaResult.rows.map((m) =>
      urlEntry({
        loc: `${FRONTEND_URL}/manga/${m.id}`,
        lastmod: m.created_at.toISOString().slice(0, 10),
        changefreq: "weekly",
        priority: "0.8",
      })
    ),
    ...tagsResult.rows.map((t) =>
      urlEntry({ loc: `${FRONTEND_URL}/tags/${t.id}`, changefreq: "weekly", priority: "0.4" })
    ),
  ];

  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
        "\n"
      )}\n</urlset>\n`
    );
});

module.exports = router;

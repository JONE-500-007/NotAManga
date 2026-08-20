// One-time migration: uploads everything currently on local disk
// (node/uploads/, excluding uploads/defaults/ which stays bundled with the
// app) into the R2 bucket, and rewrites any database path that changed shape
// along the way.
//
// Only chapter *pages* change shape: their key used to be named after the
// chapter's reader-facing number (mutable — reorder/renumber moved the
// folder) and is now named after the chapter's id (immutable — see
// utils/mangaStorage.js and utils/chapterReorder.js). Covers, art, novel
// block images, avatars, banners and link-site icons keep the exact same
// key they already had; those rows need no DB update, just an upload.
//
// Usage, from node/ (or inside the backend container):
//
//   node scripts/migrate-to-r2.js --dry-run   # report only, uploads nothing
//   node scripts/migrate-to-r2.js             # upload files and rewrite paths
//
// Safe to re-run: putObject overwrites the same key, and the DB update is
// idempotent (setting a row to the URL it's about to have anyway).
// The local uploads/ folder is never touched or deleted by this script —
// decommission it by hand once you've verified the site works off R2.

const fs = require("fs/promises");
const path = require("path");
const pool = require("../db/pool");
const { UPLOADS_ROOT } = require("../middleware/upload");
const { putObject, toR2Key } = require("../utils/r2Client");
const { chapterPageUrl } = require("../utils/mangaStorage");

const dryRun = process.argv.includes("--dry-run");

const CONTENT_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
function contentTypeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

const basename = (publicPath) => publicPath.split("/").pop();
const toLocalPath = (publicPath) => path.join(UPLOADS_ROOT, publicPath.replace(/^\/uploads\//, ""));

const stats = { uploaded: 0, missing: 0, skipped: 0 };
const problems = [];

// Uploads the file backing `currentUrl` to R2 under `targetUrl`'s key (the
// same key, unless this row's shape changed — chapter pages only). Returns
// targetUrl on success so the caller can decide whether a DB update is
// needed, or null if the local file couldn't be found.
async function migrateOne(label, currentUrl, targetUrl) {
  const localPath = toLocalPath(currentUrl);
  let buffer;
  try {
    buffer = await fs.readFile(localPath);
  } catch {
    problems.push(`${label}: local file not found (${localPath})`);
    stats.missing++;
    return null;
  }

  if (dryRun) {
    console.log(`${currentUrl === targetUrl ? "would upload" : "would upload+rekey"}  ${label}`);
  } else {
    await putObject(toR2Key(targetUrl), buffer, contentTypeFor(targetUrl));
  }
  stats.uploaded++;
  return targetUrl;
}

async function migrateSameKey(label, currentUrl) {
  if (!currentUrl) return;
  await migrateOne(label, currentUrl, currentUrl);
}

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be uploaded or written.\n" : "Migrating uploads to R2…\n");

  // ---- covers -------------------------------------------------------------
  const covers = await pool.query("SELECT id, cover_path FROM manga WHERE cover_path IS NOT NULL");
  for (const row of covers.rows) {
    await migrateSameKey(`manga ${row.id} cover`, row.cover_path);
  }

  // ---- art ------------------------------------------------------------------
  const art = await pool.query("SELECT id, image_path FROM art");
  for (const row of art.rows) {
    await migrateSameKey(`art ${row.id}`, row.image_path);
  }

  // ---- novel block images ---------------------------------------------------
  const novel = await pool.query(
    "SELECT id, image_path FROM novel_blocks WHERE block_type = 'image' AND image_path IS NOT NULL"
  );
  for (const row of novel.rows) {
    await migrateSameKey(`novel block ${row.id}`, row.image_path);
  }

  // ---- chapter pages — the one case whose key is changing --------------------
  const pages = await pool.query(
    `SELECT p.id, p.image_path, c.id AS chapter_id, c.chapter_number, m.id AS manga_id, m.work_type
       FROM pages p
       JOIN chapters c ON c.id = p.chapter_id
       JOIN manga m ON m.id = c.manga_id
      ORDER BY m.id, c.chapter_number, p.page_number`
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of pages.rows) {
      const targetUrl = chapterPageUrl(row.work_type, row.manga_id, row.chapter_id, basename(row.image_path));
      const label = `page ${row.id} (manga ${row.manga_id} ch.${row.chapter_number} -> chapter id ${row.chapter_id})`;
      const done = await migrateOne(label, row.image_path, targetUrl);
      if (done && !dryRun && done !== row.image_path) {
        await client.query("UPDATE pages SET image_path = $1 WHERE id = $2", [done, row.id]);
      }
    }
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // ---- user avatars and banners ----------------------------------------------
  // Raw columns, not the COALESCE'd ones — a NULL means "no picture chosen",
  // and the shipped default (still local, never in R2) must be left alone.
  const users = await pool.query(
    "SELECT id, avatar_path, banner_path FROM users WHERE avatar_path IS NOT NULL OR banner_path IS NOT NULL"
  );
  for (const row of users.rows) {
    await migrateSameKey(`user ${row.id} avatar`, row.avatar_path);
    await migrateSameKey(`user ${row.id} banner`, row.banner_path);
  }

  // ---- link site icons ---------------------------------------------------
  const links = await pool.query("SELECT id, icon_path FROM link_sites WHERE icon_path IS NOT NULL");
  for (const row of links.rows) {
    await migrateSameKey(`link site ${row.id} icon`, row.icon_path);
  }

  console.log("\n--- summary ---");
  console.log(`${dryRun ? "would upload" : "uploaded"}: ${stats.uploaded}`);
  console.log(`missing locally:  ${stats.missing}`);

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
    if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  }

  if (dryRun) console.log("\nDRY RUN — nothing was changed. Re-run without --dry-run to apply.");
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });

// Reconciles the uploads tree with the layout the app now writes, and
// rewrites the database paths that point at it.
//
//   uploads/manga/<id>/covers|art/<uuid>.ext        work_type = 'manga'
//   uploads/manga/<id>/chapters/<chapterNumber>/<uuid>.ext
//   uploads/novel/<id>/covers|art|novel/<uuid>.ext  work_type = 'novel'
//   uploads/users/<id>/avatars|banners/<uuid>.ext
//   uploads/defaults/profile_default.jpg, banner_default.png
//   uploads/link-site-icons/<uuid>.ext              (unchanged)
//
// Rather than translating one specific old layout, this works out where each
// database row's file *should* live and moves it there if it isn't already.
// That makes it safe on the original flat tree (covers/, pages/<chapterId>/,
// art/, novel-images/, avatars/, banners/), on a tree already partway through
// an earlier run, and on an up-to-date one (where it does nothing).
//
// Usage, from node/ (or inside the backend container):
//
//   node scripts/migrate-uploads.js --dry-run   # report only, touches nothing
//   node scripts/migrate-uploads.js             # move files and rewrite paths
//   node scripts/migrate-uploads.js --prune     # also delete unreferenced files
//
// --prune removes leftovers that no database row points at (old avatars a user
// replaced, covers swapped out, and so on). It is deliberately opt-in and
// always lists what it will remove first.
//
// The database is updated in one transaction; the filesystem can't join it, so
// files are copied to their new home and the originals unlinked only after the
// commit. A crash mid-run leaves duplicates, never missing files.
// TAKE A BACKUP OF THE DATABASE AND THE uploads/ FOLDER BEFORE RUNNING.

const fs = require("fs/promises");
const path = require("path");
const pool = require("../db/pool");
const {
  UPLOADS_ROOT,
  DEFAULTS_DIR,
  LINK_SITE_ICONS_DIR,
  LEGACY_COVERS_DIR,
  LEGACY_PAGES_DIR,
  LEGACY_ART_DIR,
  LEGACY_NOVEL_IMAGES_DIR,
  LEGACY_AVATARS_DIR,
  LEGACY_BANNERS_DIR,
  DEFAULT_AVATAR_PATH,
  DEFAULT_BANNER_PATH,
} = require("../middleware/upload");
const { mangaFileUrl, chapterPageUrl, COVERS, ART, NOVEL } = require("../utils/mangaStorage");
const { userFileUrl, AVATARS, BANNERS } = require("../utils/userStorage");

const dryRun = process.argv.includes("--dry-run");
const prune = process.argv.includes("--prune");

const stats = { alreadyCorrect: 0, moved: 0, missing: 0 };
const problems = [];
// Absolute paths this run has claimed as the source of a move. On a dry run
// nothing is actually unlinked, so without this the leftover scan below would
// report every file that is *about* to move as unreferenced junk.
const claimedSources = new Set();

const basename = (publicPath) => publicPath.split("/").pop();
const toAbsolute = (publicPath) => path.join(UPLOADS_ROOT, publicPath.replace(/^\/uploads\//, ""));

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Where a file might still be sitting, in the order worth trying: the path the
// database currently claims, then the original flat locations.
function candidateSources(currentPath, kind, ids) {
  const file = basename(currentPath);
  const legacyByKind = {
    [COVERS]: path.join(LEGACY_COVERS_DIR, file),
    [ART]: path.join(LEGACY_ART_DIR, file),
    [NOVEL]: path.join(LEGACY_NOVEL_IMAGES_DIR, file),
    [AVATARS]: path.join(LEGACY_AVATARS_DIR, file),
    [BANNERS]: path.join(LEGACY_BANNERS_DIR, file),
    page: ids.chapterId != null ? path.join(LEGACY_PAGES_DIR, String(ids.chapterId), file) : null,
  };
  return [toAbsolute(currentPath), legacyByKind[kind]].filter(Boolean);
}

// One row's worth of work: figure out the target, find the file wherever it
// still is, copy it across and report the SQL needed to point the row at it.
async function reconcile({ label, currentPath, targetPath, kind, ids }) {
  if (!currentPath) return null;
  const targetAbs = toAbsolute(targetPath);

  if (currentPath === targetPath && (await exists(targetAbs))) {
    stats.alreadyCorrect++;
    return null;
  }

  if (await exists(targetAbs)) {
    // File already in place from an interrupted run — only the row is stale.
    stats.moved++;
    return { targetPath, source: null };
  }

  for (const source of candidateSources(currentPath, kind, ids)) {
    if (!(await exists(source))) continue;
    if (!dryRun) {
      await fs.mkdir(path.dirname(targetAbs), { recursive: true });
      await fs.copyFile(source, targetAbs);
    }
    claimedSources.add(source);
    stats.moved++;
    return { targetPath, source };
  }

  problems.push(`${label}: file not found on disk (${currentPath})`);
  stats.missing++;
  return null;
}

async function main() {
  console.log(dryRun ? "DRY RUN — nothing will be moved, written or deleted.\n" : "Reconciling uploads…\n");

  const client = await pool.connect();
  const toUnlink = [];

  try {
    await client.query("BEGIN");

    // ---- covers ---------------------------------------------------------
    const covers = await client.query(
      "SELECT id, work_type, cover_path FROM manga WHERE cover_path IS NOT NULL"
    );
    for (const row of covers.rows) {
      const target = mangaFileUrl(row.work_type, row.id, COVERS, basename(row.cover_path));
      const done = await reconcile({
        label: `manga ${row.id} cover`,
        currentPath: row.cover_path,
        targetPath: target,
        kind: COVERS,
        ids: {},
      });
      if (done) {
        await client.query("UPDATE manga SET cover_path = $1 WHERE id = $2", [done.targetPath, row.id]);
        if (done.source) toUnlink.push(done.source);
      }
    }

    // ---- art ------------------------------------------------------------
    const art = await client.query(
      "SELECT a.id, a.image_path, m.id AS manga_id, m.work_type FROM art a JOIN manga m ON m.id = a.manga_id"
    );
    for (const row of art.rows) {
      const target = mangaFileUrl(row.work_type, row.manga_id, ART, basename(row.image_path));
      const done = await reconcile({
        label: `art ${row.id}`,
        currentPath: row.image_path,
        targetPath: target,
        kind: ART,
        ids: {},
      });
      if (done) {
        await client.query("UPDATE art SET image_path = $1 WHERE id = $2", [done.targetPath, row.id]);
        if (done.source) toUnlink.push(done.source);
      }
    }

    // ---- novel block images ---------------------------------------------
    const novel = await client.query(
      `SELECT nb.id, nb.image_path, m.id AS manga_id, m.work_type
         FROM novel_blocks nb
         JOIN chapters c ON c.id = nb.chapter_id
         JOIN manga m ON m.id = c.manga_id
        WHERE nb.block_type = 'image' AND nb.image_path IS NOT NULL`
    );
    for (const row of novel.rows) {
      const target = mangaFileUrl(row.work_type, row.manga_id, NOVEL, basename(row.image_path));
      const done = await reconcile({
        label: `novel block ${row.id}`,
        currentPath: row.image_path,
        targetPath: target,
        kind: NOVEL,
        ids: {},
      });
      if (done) {
        await client.query("UPDATE novel_blocks SET image_path = $1 WHERE id = $2", [done.targetPath, row.id]);
        if (done.source) toUnlink.push(done.source);
      }
    }

    // ---- chapter pages ---------------------------------------------------
    const pages = await client.query(
      `SELECT p.id, p.image_path, c.id AS chapter_id, c.chapter_number, m.id AS manga_id, m.work_type
         FROM pages p
         JOIN chapters c ON c.id = p.chapter_id
         JOIN manga m ON m.id = c.manga_id
        ORDER BY m.id, c.chapter_number, p.page_number`
    );
    for (const row of pages.rows) {
      const target = chapterPageUrl(row.work_type, row.manga_id, row.chapter_number, basename(row.image_path));
      const done = await reconcile({
        label: `page ${row.id} (manga ${row.manga_id} ch.${row.chapter_number})`,
        currentPath: row.image_path,
        targetPath: target,
        kind: "page",
        ids: { chapterId: row.chapter_id },
      });
      if (done) {
        await client.query("UPDATE pages SET image_path = $1 WHERE id = $2", [done.targetPath, row.id]);
        if (done.source) toUnlink.push(done.source);
      }
    }

    // ---- user avatars and banners ---------------------------------------
    // Read raw, not through the COALESCE columns — a NULL here means "no
    // picture chosen", and the shipped default must never be moved into some
    // individual user's folder.
    const users = await client.query(
      "SELECT id, avatar_path, banner_path FROM users WHERE avatar_path IS NOT NULL OR banner_path IS NOT NULL"
    );
    for (const row of users.rows) {
      for (const [column, kind, current] of [
        ["avatar_path", AVATARS, row.avatar_path],
        ["banner_path", BANNERS, row.banner_path],
      ]) {
        if (!current) continue;
        const target = userFileUrl(row.id, kind, basename(current));
        const done = await reconcile({
          label: `user ${row.id} ${kind}`,
          currentPath: current,
          targetPath: target,
          kind,
          ids: {},
        });
        if (done) {
          await client.query(`UPDATE users SET ${column} = $1 WHERE id = $2`, [done.targetPath, row.id]);
          if (done.source) toUnlink.push(done.source);
        }
      }
    }

    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\nAborted — the database was rolled back.");
    console.error("Any files copied so far are duplicates; the originals are untouched, so it is safe to re-run.");
    throw err;
  } finally {
    client.release();
  }

  // ---- the two shipped defaults ------------------------------------------
  // Referenced by constant rather than by any row, so they move on their own.
  for (const [from, to] of [
    [path.join(LEGACY_AVATARS_DIR, "profile_default.jpg"), toAbsolute(DEFAULT_AVATAR_PATH)],
    [path.join(LEGACY_BANNERS_DIR, "banner_default.png"), toAbsolute(DEFAULT_BANNER_PATH)],
  ]) {
    claimedSources.add(from);
    if (await exists(to)) continue;
    if (!(await exists(from))) {
      problems.push(`default image missing: neither ${from} nor ${to} exists`);
      continue;
    }
    console.log(`default image -> ${path.relative(UPLOADS_ROOT, to)}`);
    if (!dryRun) {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      await fs.unlink(from).catch(() => {});
    }
  }

  if (!dryRun) {
    for (const file of toUnlink) await fs.unlink(file).catch(() => {});
  }

  // ---- what's left over ---------------------------------------------------
  // Anything still sitting in a legacy folder now that every row has been
  // pointed elsewhere is unreferenced: a replaced avatar, a swapped cover, a
  // deleted chapter's leftovers.
  const legacyDirs = [
    LEGACY_COVERS_DIR,
    LEGACY_PAGES_DIR,
    LEGACY_ART_DIR,
    LEGACY_NOVEL_IMAGES_DIR,
    LEGACY_AVATARS_DIR,
    LEGACY_BANNERS_DIR,
  ];
  const leftovers = [];
  for (const dir of legacyDirs) {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const abs = path.join(entry.parentPath || entry.path || dir, entry.name);
      if (!claimedSources.has(abs)) leftovers.push(abs);
    }
  }

  console.log("\n--- summary ---");
  console.log(`already in the right place: ${stats.alreadyCorrect}`);
  console.log(`${dryRun ? "would move" : "moved"}:${" ".repeat(dryRun ? 18 : 21)}${stats.moved}`);
  console.log(`referenced but missing:     ${stats.missing}`);

  if (problems.length > 0) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
    if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  }

  if (leftovers.length > 0) {
    console.log(`\n${leftovers.length} unreferenced file(s) left in the old folders:`);
    for (const f of leftovers.slice(0, 30)) console.log(`  - ${path.relative(UPLOADS_ROOT, f)}`);
    if (leftovers.length > 30) console.log(`  … and ${leftovers.length - 30} more`);

    if (prune && !dryRun) {
      for (const f of leftovers) await fs.unlink(f).catch(() => {});
      for (const dir of legacyDirs) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      console.log("\nPruned: those files and the now-empty legacy folders were deleted.");
    } else if (!prune) {
      console.log("\nLeft in place. Re-run with --prune to delete them (and the empty folders).");
    }
  } else if (!dryRun) {
    for (const dir of legacyDirs) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  if (dryRun) console.log("\nDRY RUN — nothing was changed. Re-run without --dry-run to apply.");
  console.log(`\n(link-site icons stay put in ${path.relative(UPLOADS_ROOT, LINK_SITE_ICONS_DIR)}/ — they belong to no work or account.)`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });

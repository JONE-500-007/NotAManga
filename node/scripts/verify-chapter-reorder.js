// Integration check for utils/chapterReorder.js against the live database.
//
//   node scripts/verify-chapter-reorder.js <mangaId>
//
// Picks the given manga (or the one with the most chapters), swaps its two
// newest chapters, asserts that the numbers were permuted rather than
// renumbered and that every page's stored path is byte-for-byte unchanged
// (chapter folders are keyed by chapter id now, not chapter number, so a
// reorder is pure DB work — nothing about a page's path should ever move)
// — then puts everything back exactly as it was.
//
// Read-only in effect: whatever it changes, it reverses before exiting.

const pool = require("../db/pool");
const { reorderChapters } = require("../utils/chapterReorder");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got      ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`);
}

async function snapshot(mangaId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.chapter_number,
            (SELECT COUNT(*) FROM pages p WHERE p.chapter_id = c.id) AS page_count,
            (SELECT array_agg(p.image_path ORDER BY p.page_number) FROM pages p WHERE p.chapter_id = c.id) AS paths
       FROM chapters c WHERE c.manga_id = $1 ORDER BY c.chapter_number ASC`,
    [mangaId]
  );
  return rows;
}

async function applyOrder(mangaId, orderedChapterIds) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reorderChapters(client, { mangaId, orderedChapterIds });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  let mangaId = Number(process.argv[2]);
  if (!mangaId) {
    const { rows } = await pool.query(
      `SELECT c.manga_id, COUNT(*) AS n FROM chapters c
        JOIN pages p ON p.chapter_id = c.id
        GROUP BY c.manga_id ORDER BY n DESC LIMIT 1`
    );
    mangaId = rows[0]?.manga_id;
  }
  if (!mangaId) throw new Error("No manga with chapters found to test against.");

  const before = await snapshot(mangaId);
  if (before.length < 2) throw new Error(`Manga ${mangaId} has fewer than 2 chapters.`);

  console.log(`Testing manga ${mangaId} — ${before.length} chapters`);
  console.log(`Numbers before: ${before.map((c) => c.chapter_number).join(", ")}\n`);

  const ascIds = before.map((c) => c.id);
  const numbersBefore = before.map((c) => String(Number(c.chapter_number)));

  // Swap the last two chapters in ascending order.
  const swapped = [...ascIds];
  [swapped[swapped.length - 2], swapped[swapped.length - 1]] = [
    swapped[swapped.length - 1],
    swapped[swapped.length - 2],
  ];

  const a = before[before.length - 2];
  const b = before[before.length - 1];

  await applyOrder(mangaId, swapped);

  const after = await snapshot(mangaId);
  const numbersAfter = after.map((c) => String(Number(c.chapter_number)));

  // 1. The set of numbers in use is untouched — this is what the old
  //    renumber-to-1..N behaviour destroyed for decimal chapters.
  check("chapter numbers are permuted, not renumbered", numbersAfter, numbersBefore);

  // 2. The two swapped chapters actually traded numbers.
  const byId = new Map(after.map((c) => [c.id, String(Number(c.chapter_number))]));
  check(
    "the two chapters traded numbers",
    [byId.get(a.id), byId.get(b.id)],
    [String(Number(b.chapter_number)), String(Number(a.chapter_number))]
  );

  // 3. Page counts are unchanged — nothing was orphaned.
  check(
    "page counts unchanged",
    after.map((c) => Number(c.page_count)).sort((x, y) => x - y),
    before.map((c) => Number(c.page_count)).sort((x, y) => x - y)
  );

  // 4. Every page's stored path is byte-for-byte identical to before — a
  //    chapter's R2 key prefix is its id, which a reorder never touches.
  // Sorted by chapter id (not the snapshot's chapter_number order, which the
  // reorder deliberately changes for two rows) so this compares each
  // chapter's own paths, not incidental row position.
  const byIdSorted = (rows) => rows.map((c) => [c.id, c.paths]).sort((x, y) => x[0] - y[0]);
  check("page paths are completely unchanged by the reorder", byIdSorted(after), byIdSorted(before));

  // Put it back.
  await applyOrder(mangaId, ascIds);
  const restored = await snapshot(mangaId);
  check(
    "restored to the original order",
    restored.map((c) => [c.id, String(Number(c.chapter_number))]),
    before.map((c) => [c.id, String(Number(c.chapter_number))])
  );

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  return failures;
}

main()
  .then(async (f) => {
    await pool.end();
    process.exit(f === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });

const fs = require("fs/promises");
const path = require("path");
const { chaptersDir, chapterDir, chapterFolderName, workRoot } = require("./mangaStorage");

// Parked numbers live far below any real chapter number while the UNIQUE
// (manga_id, chapter_number) index is briefly in an inconsistent state.
const PARK_BASE = -1000000;

// Reordering chapters is a *permutation of the numbers already in use*, not a
// renumbering to 1..N. That distinction matters: a series with a 5.5 side
// story and a 38.6 extra keeps those numbers here, where the old
// number-by-array-position approach flattened every chapter to a whole number
// the first time anyone dragged a row.
//
// Chapter numbers also name the on-disk folders (see utils/mangaStorage.js),
// so handing a number to a different chapter means moving that chapter's
// pages with it and rewriting pages.image_path to match. The DB work runs
// inside the caller's transaction; the filesystem can't join that
// transaction, so the moves are staged through temporary names and unwound by
// hand if anything downstream throws.
async function reorderChapters(client, { workType, mangaId, orderedChapterIds }) {
  const { rows: current } = await client.query(
    "SELECT id, chapter_number FROM chapters WHERE manga_id = $1",
    [mangaId]
  );

  const numberById = new Map(current.map((r) => [r.id, r.chapter_number]));
  const unique = new Set(orderedChapterIds);
  const isSamePermutation =
    orderedChapterIds.length === current.length &&
    unique.size === orderedChapterIds.length &&
    orderedChapterIds.every((id) => numberById.has(id));
  if (!isSamePermutation) {
    const err = new Error("orderedChapterIds must list every chapter of this manga exactly once");
    err.status = 400;
    throw err;
  }

  // The pool of numbers to hand out, low to high, matched positionally against
  // the requested order. Compared numerically because NUMERIC arrives as text
  // ("10" would sort before "9" as a string).
  const numbersAscending = current.map((r) => r.chapter_number).sort((a, b) => Number(a) - Number(b));

  const moves = orderedChapterIds
    .map((id, index) => ({ id, from: numberById.get(id), to: numbersAscending[index] }))
    .filter((m) => Number(m.from) !== Number(m.to));

  if (moves.length === 0) return;

  // Phase 1 on disk: park every folder that's moving under a name nothing else
  // can claim, so a cycle (5 -> 6, 6 -> 5) can't collide mid-rename.
  // `staged` doubles as the undo log for the catch below.
  const staged = [];
  try {
    for (const move of moves) {
      const original = chapterDir(workType, mangaId, move.from);
      const temp = path.join(chaptersDir(workType, mangaId), `.reorder-${move.id}`);
      try {
        await fs.rename(original, temp);
        staged.push({ temp, original, final: chapterDir(workType, mangaId, move.to), moved: false });
      } catch (err) {
        // Novel chapters keep their images in the manga-level novel/ folder
        // and own no chapter directory at all — nothing to move.
        if (err.code !== "ENOENT") throw err;
      }
    }

    // The DB half. Same two-step parking the generic reorderRows uses: the
    // UNIQUE (manga_id, chapter_number) index would reject an intermediate
    // state where two chapters briefly share a number.
    for (let i = 0; i < moves.length; i++) {
      await client.query("UPDATE chapters SET chapter_number = $1 WHERE id = $2 AND manga_id = $3", [
        PARK_BASE - i,
        moves[i].id,
        mangaId,
      ]);
    }
    for (const move of moves) {
      await client.query("UPDATE chapters SET chapter_number = $1 WHERE id = $2 AND manga_id = $3", [
        move.to,
        move.id,
        mangaId,
      ]);
      // Page rows keep their filename but belong to a new folder now. Rebuilt
      // from the stored path's last segment rather than re-derived from the
      // upload, so a page renamed by hand on disk still lines up.
      await client.query(
        `UPDATE pages
            SET image_path = '/uploads/' || $1::text || '/' || $2::text || '/chapters/' || $3::text || '/' ||
                             regexp_replace(image_path, '^.*/', '')
          WHERE chapter_id = $4`,
        [workRoot(workType), String(mangaId), chapterFolderName(move.to), move.id]
      );
    }

    // Phase 2 on disk: temporary names become the real ones.
    for (const entry of staged) {
      await fs.rename(entry.temp, entry.final);
      entry.moved = true;
    }
  } catch (err) {
    // Put every folder back where it was. The caller rolls the DB back, so a
    // directory left parked under .reorder-* — or already sitting at its new
    // name while the database says otherwise — would strand that chapter.
    for (const entry of staged) {
      await fs.rename(entry.moved ? entry.final : entry.temp, entry.original).catch(() => {});
    }
    throw err;
  }
}

// The other way a chapter's number changes: the edit-chapter form typing a
// new one directly. Same consequence as a reorder — the folder is named after
// that number — but a single move rather than a permutation, so it needs none
// of the staging above.
async function renameChapterFolder(client, { workType, mangaId, chapterId, fromNumber, toNumber }) {
  if (Number(fromNumber) === Number(toNumber)) return;

  const from = chapterDir(workType, mangaId, fromNumber);
  const to = chapterDir(workType, mangaId, toNumber);

  let moved = false;
  try {
    await fs.mkdir(chaptersDir(workType, mangaId), { recursive: true });
    await fs.rename(from, to);
    moved = true;
  } catch (err) {
    // Novel chapters own no page directory — nothing to move.
    if (err.code !== "ENOENT") throw err;
  }

  try {
    await client.query(
      `UPDATE pages
          SET image_path = '/uploads/' || $1::text || '/' || $2::text || '/chapters/' || $3::text || '/' ||
                           regexp_replace(image_path, '^.*/', '')
        WHERE chapter_id = $4`,
      [workRoot(workType), String(mangaId), chapterFolderName(toNumber), chapterId]
    );
  } catch (err) {
    if (moved) await fs.rename(to, from).catch(() => {});
    throw err;
  }
}

module.exports = { reorderChapters, renameChapterFolder };

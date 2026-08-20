// Parked numbers live far below any real chapter number while the UNIQUE
// (manga_id, chapter_number) index is briefly in an inconsistent state.
const PARK_BASE = -1000000;

// Reordering chapters is a *permutation of the numbers already in use*, not a
// renumbering to 1..N. That distinction matters: a series with a 5.5 side
// story and a 38.6 extra keeps those numbers here, where the old
// number-by-array-position approach flattened every chapter to a whole number
// the first time anyone dragged a row.
//
// Chapter pages are keyed by chapter *id* on disk/R2 (see
// utils/mangaStorage.js), not by this number, so unlike the old filesystem
// layout this is purely a DB permutation — nothing about a chapter's stored
// files ever needs to move just because its number changed.
async function reorderChapters(client, { mangaId, orderedChapterIds }) {
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

  // Two-step parking: the UNIQUE (manga_id, chapter_number) index would
  // reject an intermediate state where two chapters briefly share a number.
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
  }
}

module.exports = { reorderChapters };

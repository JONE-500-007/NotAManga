const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { putObject, deleteObjectsByPrefix, toR2Key } = require("./r2Client");

// Everything a single work owns lives under one R2 key prefix, so it can be
// listed/removed as one unit. Comics and light novels are split at the top
// level by manga.work_type, since they're browsed and managed as separate
// things:
//
//   manga/<id>/covers/<uuid>.jpg      (work_type = 'manga')
//   manga/<id>/art/<uuid>.jpg
//   manga/<id>/chapters/<chapterId>/<uuid>.jpg
//
//   novel/<id>/covers/<uuid>.jpg      (work_type = 'novel')
//   novel/<id>/art/<uuid>.jpg
//   novel/<id>/novel/<uuid>.jpg       (chapter block images)
//
// The subfolder names are identical either way; a comic simply never grows a
// novel/ folder and a light novel never grows a chapters/ one, because novel
// chapters store their images as blocks against the work rather than as pages
// under a chapter.
//
// Chapter folders are keyed by chapter *id*, not the reader-facing chapter
// number — the id never changes, so reordering/renumbering chapters
// (utils/chapterReorder.js) is a pure DB update and never has to move a
// single object in R2 (which has no rename, only copy+delete per key).
const WORK_ROOTS = { manga: "manga", novel: "novel" };

// work_type is constrained to 'manga' | 'novel' in the schema, but a stray
// value here would silently scatter files into a folder named after it.
function workRoot(workType) {
  const root = WORK_ROOTS[workType];
  if (!root) throw new Error(`Unknown work_type for a storage path: ${workType}`);
  return root;
}

// Where each kind of image sits inside a manga's folder. Values are also the
// public URL segment, so the two can never drift apart.
const COVERS = "covers";
const ART = "art";
const NOVEL = "novel";
const CHAPTERS = "chapters";

function mangaKeyPrefix(workType, mangaId) {
  return `${workRoot(workType)}/${mangaId}`;
}

function mangaKindPrefix(workType, mangaId, kind) {
  return `${mangaKeyPrefix(workType, mangaId)}/${kind}`;
}

function chaptersPrefix(workType, mangaId) {
  return `${mangaKeyPrefix(workType, mangaId)}/${CHAPTERS}`;
}

function chapterPrefix(workType, mangaId, chapterId) {
  return `${chaptersPrefix(workType, mangaId)}/${chapterId}`;
}

function mangaFileUrl(workType, mangaId, kind, filename) {
  return `/uploads/${mangaKindPrefix(workType, mangaId, kind)}/${filename}`;
}

function chapterPageUrl(workType, mangaId, chapterId, filename) {
  return `/uploads/${chapterPrefix(workType, mangaId, chapterId)}/${filename}`;
}

// Validates an in-memory upload (multer memoryStorage's file.buffer) and
// writes it to R2 under the manga's own key prefix, returning the public URL
// to store. Same magic-byte rule as everywhere else: the extension comes
// from the bytes, never the client-supplied name.
async function saveMangaImage(file, workType, mangaId, kind) {
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const url = mangaFileUrl(workType, mangaId, kind, filename);
  await putObject(toR2Key(url), file.buffer, file.mimetype);
  return url;
}

// Deleting a work is now one prefix removal instead of chasing individual
// files across shared covers/, art/ and novel-images/ folders.
function removeMangaDir(workType, mangaId) {
  return deleteObjectsByPrefix(`${mangaKeyPrefix(workType, mangaId)}/`);
}

function removeChapterDir(workType, mangaId, chapterId) {
  return deleteObjectsByPrefix(`${chapterPrefix(workType, mangaId, chapterId)}/`);
}

module.exports = {
  WORK_ROOTS,
  COVERS,
  ART,
  NOVEL,
  CHAPTERS,
  workRoot,
  mangaKeyPrefix,
  mangaKindPrefix,
  chaptersPrefix,
  chapterPrefix,
  mangaFileUrl,
  chapterPageUrl,
  saveMangaImage,
  removeMangaDir,
  removeChapterDir,
};

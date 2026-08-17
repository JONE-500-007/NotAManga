const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { UPLOADS_ROOT } = require("../middleware/upload");
const { detectImageExtension } = require("./imageValidation");

// Everything a single work owns lives under one folder, so it can be copied
// on/off the server (or deleted) as one unit. Comics and light novels are
// split at the top level by manga.work_type, since they're browsed and
// managed as separate things:
//
//   uploads/manga/<id>/covers/<uuid>.jpg      (work_type = 'manga')
//   uploads/manga/<id>/art/<uuid>.jpg
//   uploads/manga/<id>/chapters/<chapterNumber>/<uuid>.jpg
//
//   uploads/novel/<id>/covers/<uuid>.jpg      (work_type = 'novel')
//   uploads/novel/<id>/art/<uuid>.jpg
//   uploads/novel/<id>/novel/<uuid>.jpg       (chapter block images)
//
// The subfolder names are identical either way; a comic simply never grows a
// novel/ folder and a light novel never grows a chapters/ one, because novel
// chapters store their images as blocks against the work rather than as pages
// under a chapter.
//
// Chapter folders are named by the *chapter number* a reader sees (1, 2,
// 5.5, ...), not the database id, so the tree stays readable on its own.
// That number is mutable — reordering chapters reassigns them — so anything
// that changes it has to move these folders and rewrite pages.image_path to
// match, in lockstep. See utils/chapterReorder.js.
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

// chapter_number is NUMERIC in Postgres, which node-postgres hands back as a
// string that may carry trailing zeros ("12.0", "5.50"). Folder names have to
// be one canonical spelling of a given number or the same chapter resolves to
// two different directories depending on which query loaded it.
function chapterFolderName(chapterNumber) {
  const parsed = Number(chapterNumber);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid chapter number for a storage path: ${chapterNumber}`);
  }
  return String(parsed);
}

function mangaDir(workType, mangaId) {
  return path.join(UPLOADS_ROOT, workRoot(workType), String(mangaId));
}

function mangaKindDir(workType, mangaId, kind) {
  return path.join(mangaDir(workType, mangaId), kind);
}

function chaptersDir(workType, mangaId) {
  return path.join(mangaDir(workType, mangaId), CHAPTERS);
}

function chapterDir(workType, mangaId, chapterNumber) {
  return path.join(chaptersDir(workType, mangaId), chapterFolderName(chapterNumber));
}

function mangaFileUrl(workType, mangaId, kind, filename) {
  return `/uploads/${workRoot(workType)}/${mangaId}/${kind}/${filename}`;
}

function chapterPageUrl(workType, mangaId, chapterNumber, filename) {
  return `/uploads/${workRoot(workType)}/${mangaId}/${CHAPTERS}/${chapterFolderName(chapterNumber)}/${filename}`;
}

// Validates an in-memory upload (multer memoryStorage's file.buffer) and
// writes it into the manga's own folder, returning the public URL to store.
// Same magic-byte rule as middleware/upload.js's saveValidatedImage: the
// extension comes from the bytes, never from the client-supplied name.
async function saveMangaImage(file, workType, mangaId, kind) {
  const destDir = mangaKindDir(workType, mangaId, kind);
  await fs.mkdir(destDir, { recursive: true });
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(destDir, filename), file.buffer);
  return mangaFileUrl(workType, mangaId, kind, filename);
}

// Deleting a work is now one recursive remove instead of chasing individual
// files across shared covers/, art/ and novel-images/ folders.
function removeMangaDir(workType, mangaId) {
  return fs.rm(mangaDir(workType, mangaId), { recursive: true, force: true }).catch(() => {});
}

function removeChapterDir(workType, mangaId, chapterNumber) {
  return fs.rm(chapterDir(workType, mangaId, chapterNumber), { recursive: true, force: true }).catch(() => {});
}

module.exports = {
  WORK_ROOTS,
  COVERS,
  ART,
  NOVEL,
  CHAPTERS,
  workRoot,
  chapterFolderName,
  mangaDir,
  mangaKindDir,
  chaptersDir,
  chapterDir,
  mangaFileUrl,
  chapterPageUrl,
  saveMangaImage,
  removeMangaDir,
  removeChapterDir,
};

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const COVERS_DIR = path.join(UPLOADS_ROOT, "covers");
const PAGES_DIR = path.join(UPLOADS_ROOT, "pages");
const ART_DIR = path.join(UPLOADS_ROOT, "art");

fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(PAGES_DIR, { recursive: true });
fs.mkdirSync(ART_DIR, { recursive: true });

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed"));
  }
  cb(null, true);
}

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, COVERS_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${crypto.randomUUID()}-${safeName}`);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const chapterPagesUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 300 },
});

const artUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ART_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${crypto.randomUUID()}-${safeName}`);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = {
  coverUpload,
  chapterPagesUpload,
  artUpload,
  COVERS_DIR,
  PAGES_DIR,
  ART_DIR,
  UPLOADS_ROOT,
};

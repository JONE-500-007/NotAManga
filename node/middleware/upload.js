const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const COVERS_DIR = path.join(UPLOADS_ROOT, "covers");
const PAGES_DIR = path.join(UPLOADS_ROOT, "pages");
const ART_DIR = path.join(UPLOADS_ROOT, "art");
const AVATARS_DIR = path.join(UPLOADS_ROOT, "avatars");
const BANNERS_DIR = path.join(UPLOADS_ROOT, "banners");

fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(PAGES_DIR, { recursive: true });
fs.mkdirSync(ART_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(BANNERS_DIR, { recursive: true });

// Shipped alongside the app (not user-uploaded), served by users who haven't
// picked their own avatar/banner yet. Never pass these through
// deleteUploadedFile — see the raw (non-COALESCE) lookups in users.routes.js.
const DEFAULT_AVATAR_PATH = "/uploads/avatars/profile_default.jpg";
const DEFAULT_BANNER_PATH = "/uploads/banners/banner_default.png";

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

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${crypto.randomUUID()}-${safeName}`);
    },
  }),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, BANNERS_DIR),
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
  avatarUpload,
  bannerUpload,
  COVERS_DIR,
  PAGES_DIR,
  ART_DIR,
  AVATARS_DIR,
  BANNERS_DIR,
  UPLOADS_ROOT,
  DEFAULT_AVATAR_PATH,
  DEFAULT_BANNER_PATH,
};

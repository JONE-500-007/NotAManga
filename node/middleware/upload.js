const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { detectImageExtension } = require("../utils/imageValidation");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const COVERS_DIR = path.join(UPLOADS_ROOT, "covers");
const PAGES_DIR = path.join(UPLOADS_ROOT, "pages");
const ART_DIR = path.join(UPLOADS_ROOT, "art");
const AVATARS_DIR = path.join(UPLOADS_ROOT, "avatars");
const BANNERS_DIR = path.join(UPLOADS_ROOT, "banners");
const NOVEL_IMAGES_DIR = path.join(UPLOADS_ROOT, "novel-images");
const LINK_SITE_ICONS_DIR = path.join(UPLOADS_ROOT, "link-site-icons");

fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(PAGES_DIR, { recursive: true });
fs.mkdirSync(ART_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(BANNERS_DIR, { recursive: true });
fs.mkdirSync(NOVEL_IMAGES_DIR, { recursive: true });
fs.mkdirSync(LINK_SITE_ICONS_DIR, { recursive: true });

// Shipped alongside the app (not user-uploaded), served by users who haven't
// picked their own avatar/banner yet. Never pass these through
// deleteUploadedFile — see the raw (non-COALESCE) lookups in users.routes.js.
const DEFAULT_AVATAR_PATH = "/uploads/avatars/profile_default.jpg";
const DEFAULT_BANNER_PATH = "/uploads/banners/banner_default.png";

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    const err = new Error("Only image files are allowed");
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

// Cheap client-claimed-mimetype pre-filter above, then buffered into memory
// so every route can run the buffer through detectImageExtension (real
// magic-byte check) before anything is written to disk under a name/type an
// attacker chose. See utils/imageValidation.js for why that check matters.
const memoryUploadOptions = {
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
};

const coverUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024 } });
const artUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024 } });
const avatarUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024 } });
const bannerUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024 } });
const novelImageUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024, files: 100 } });
const linkSiteIconUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 2 * 1024 * 1024 } });
const chapterPagesUpload = multer({ ...memoryUploadOptions, limits: { fileSize: 10 * 1024 * 1024, files: 300 } });

// Validates a single in-memory upload (multer memoryStorage's file.buffer)
// and writes it to destDir under a fresh random name + the *detected*
// extension. Never trust file.originalname's extension or file.mimetype —
// both come straight from the client.
async function saveValidatedImage(file, destDir) {
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.promises.writeFile(path.join(destDir, filename), file.buffer);
  return filename;
}

module.exports = {
  coverUpload,
  chapterPagesUpload,
  artUpload,
  avatarUpload,
  bannerUpload,
  novelImageUpload,
  linkSiteIconUpload,
  saveValidatedImage,
  COVERS_DIR,
  PAGES_DIR,
  ART_DIR,
  AVATARS_DIR,
  BANNERS_DIR,
  NOVEL_IMAGES_DIR,
  LINK_SITE_ICONS_DIR,
  UPLOADS_ROOT,
  DEFAULT_AVATAR_PATH,
  DEFAULT_BANNER_PATH,
};

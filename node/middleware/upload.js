const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { detectImageExtension } = require("../utils/imageValidation");
const { putObject } = require("../utils/r2Client");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

// Belongs to no single work or account, so it stays top-level. Per-work files
// live under manga/{manga,novel}/<id>/ (utils/mangaStorage.js) and per-account
// ones under users/<id>/ (utils/userStorage.js). This one's an R2 key prefix,
// not a filesystem path — link site icons live in the bucket like every
// other upload now.
const LINK_SITE_ICONS_PREFIX = "link-site-icons";

// Shipped with the app rather than uploaded, and shared by every account
// that hasn't picked its own picture — so they can't live in any one user's
// folder. Served from R2 like everything else (see uploadAccess.routes.js);
// this local copy is just the source scripts/upload-defaults.js reads from
// when (re-)seeding the defaults/ prefix in the bucket.
const DEFAULTS_DIR = path.join(UPLOADS_ROOT, "defaults");

// Shipped alongside the app (not user-uploaded), served by users who haven't
// picked their own avatar/banner yet. Never pass these through
// deleteUploadedFile — see the raw (non-COALESCE) lookups in users.routes.js.
const DEFAULT_AVATAR_PATH = "/uploads/defaults/profile_default.jpg";
const DEFAULT_BANNER_PATH = "/uploads/defaults/banner_default.png";

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
// and writes it to R2 under keyPrefix/<uuid>.<detected extension>. Never
// trust file.originalname's extension or file.mimetype — both come straight
// from the client. Returns the public "/uploads/..." URL to store.
async function saveValidatedImage(file, keyPrefix) {
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = `${keyPrefix}/${filename}`;
  await putObject(key, file.buffer, file.mimetype);
  return `/uploads/${key}`;
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
  LINK_SITE_ICONS_PREFIX,
  DEFAULTS_DIR,
  UPLOADS_ROOT,
  DEFAULT_AVATAR_PATH,
  DEFAULT_BANNER_PATH,
};

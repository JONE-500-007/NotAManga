const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { UPLOADS_ROOT } = require("../middleware/upload");
const { detectImageExtension } = require("./imageValidation");

// Each account's images sit under its own folder, mirroring how a work's
// files are grouped in utils/mangaStorage.js:
//
//   uploads/users/<userId>/avatars/<uuid>.jpg
//   uploads/users/<userId>/banners/<uuid>.jpg
//
// Both stay plural (and a folder rather than a bare file) because replacing a
// picture writes the new one before the old is unlinked — briefly there are
// two — and because it keeps the layout the same shape as the manga tree.
const USERS_ROOT = path.join(UPLOADS_ROOT, "users");

const AVATARS = "avatars";
const BANNERS = "banners";

function userDir(userId) {
  return path.join(USERS_ROOT, String(userId));
}

function userKindDir(userId, kind) {
  return path.join(userDir(userId), kind);
}

function userFileUrl(userId, kind, filename) {
  return `/uploads/users/${userId}/${kind}/${filename}`;
}

// Same magic-byte rule as everywhere else: the extension comes from the
// file's actual bytes, never the client-supplied name or mimetype.
async function saveUserImage(file, userId, kind) {
  const destDir = userKindDir(userId, kind);
  await fs.mkdir(destDir, { recursive: true });
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(destDir, filename), file.buffer);
  return userFileUrl(userId, kind, filename);
}

module.exports = { USERS_ROOT, AVATARS, BANNERS, userDir, userKindDir, userFileUrl, saveUserImage };

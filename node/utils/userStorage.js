const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { putObject, toR2Key } = require("./r2Client");

// Each account's images sit under its own R2 key prefix, mirroring how a
// work's files are grouped in utils/mangaStorage.js:
//
//   users/<userId>/avatars/<uuid>.jpg
//   users/<userId>/banners/<uuid>.jpg
const AVATARS = "avatars";
const BANNERS = "banners";

function userFileUrl(userId, kind, filename) {
  return `/uploads/users/${userId}/${kind}/${filename}`;
}

// Same magic-byte rule as everywhere else: the extension comes from the
// file's actual bytes, never the client-supplied name or mimetype.
async function saveUserImage(file, userId, kind) {
  const ext = await detectImageExtension(file.buffer);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const url = userFileUrl(userId, kind, filename);
  await putObject(toR2Key(url), file.buffer, file.mimetype);
  return url;
}

module.exports = { AVATARS, BANNERS, userFileUrl, saveUserImage };

// Uploads the app's shipped (not user-uploaded) image assets to R2:
// uploads/defaults/ (default avatar/banner) and uploads/image_icon/ (OAuth
// button logos, site favicon). These aren't tracked by any database row —
// scripts/migrate-to-r2.js only follows rows, so it never touches them —
// which is why this is a separate script. Re-run any time one of these
// files changes locally to push the new version to R2.
//
//   node scripts/upload-static-assets.js

const fs = require("fs/promises");
const path = require("path");
const { UPLOADS_ROOT } = require("../middleware/upload");
const { putObject } = require("../utils/r2Client");

const CONTENT_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
function contentTypeFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

const PREFIXES = ["defaults", "image_icon"];

async function main() {
  for (const prefix of PREFIXES) {
    const dir = path.join(UPLOADS_ROOT, prefix);
    const files = await fs.readdir(dir).catch(() => []);
    for (const filename of files) {
      const buffer = await fs.readFile(path.join(dir, filename));
      await putObject(`${prefix}/${filename}`, buffer, contentTypeFor(filename));
      console.log(`uploaded ${prefix}/${filename} (${buffer.length} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

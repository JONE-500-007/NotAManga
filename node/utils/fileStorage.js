const fs = require("fs/promises");
const path = require("path");
const { UPLOADS_ROOT } = require("../middleware/upload");

function deleteUploadedFile(publicPath) {
  if (!publicPath) return Promise.resolve();
  const relative = publicPath.replace(/^\/uploads\//, "");
  return fs.unlink(path.join(UPLOADS_ROOT, relative)).catch(() => {});
}

module.exports = { deleteUploadedFile };

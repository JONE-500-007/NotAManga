const { deleteObject, toR2Key } = require("./r2Client");

function deleteUploadedFile(publicPath) {
  if (!publicPath) return Promise.resolve();
  return deleteObject(toR2Key(publicPath)).catch(() => {});
}

module.exports = { deleteUploadedFile };

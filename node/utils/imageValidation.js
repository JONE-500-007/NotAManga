// file-type v17+ dropped CommonJS support, so it's loaded via a dynamic
// import() from this require()-based module — Node supports that from CJS
// without needing to convert the whole backend to ESM. Cached after the
// first call, so this doesn't re-import on every upload. (Staying on the
// last CJS-compatible v16 wasn't an option: it carries a moderate DoS —
// an infinite loop parsing a malformed ASF-like buffer — reachable by any
// authenticated user uploading an avatar/cover/etc.)
let fileTypeFromBufferPromise;
function getFileTypeFromBuffer() {
  if (!fileTypeFromBufferPromise) {
    fileTypeFromBufferPromise = import("file-type").then((mod) => mod.fileTypeFromBuffer);
  }
  return fileTypeFromBufferPromise;
}

// Keyed by the magic-byte-detected MIME type, never the client-supplied
// Content-Type or original filename extension — both are attacker
// controlled. Without this, a file named "x.svg"/"x.html" sent with a
// spoofed "image/png" Content-Type would pass a naive mimetype check and
// get served back by express.static with a script-executing Content-Type
// (stored XSS), since express.static infers Content-Type from the stored
// file's extension.
const ALLOWED_IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Sniffs the real file type from its bytes and returns the extension to
// store it under. Throws (with a 400 status) if the buffer isn't one of the
// allowed raster image formats, regardless of what the upload claimed to be.
async function detectImageExtension(buffer) {
  const fileTypeFromBuffer = await getFileTypeFromBuffer();
  const detected = await fileTypeFromBuffer(buffer);
  const ext = detected && ALLOWED_IMAGE_EXTENSIONS[detected.mime];
  if (!ext) {
    const err = new Error("Unsupported or invalid image file");
    err.status = 400;
    throw err;
  }
  return ext;
}

module.exports = { detectImageExtension };

const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { chapterPageUrl } = require("./mangaStorage");
const { putObject, toR2Key } = require("./r2Client");

// Pages live under the chapter's own R2 key prefix, keyed by chapter *id*
// (immutable) rather than the reader-facing chapter number — see
// utils/mangaStorage.js for why.
async function savePageFiles(client, { chapterId, workType, mangaId, files, startPageNumber }) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageNumber = startPageNumber + i;
    // Extension is derived from the file's real magic bytes, not the
    // client-supplied originalname/mimetype — see utils/imageValidation.js.
    const ext = await detectImageExtension(file.buffer);
    const filename = `${crypto.randomUUID()}.${ext}`;
    const url = chapterPageUrl(workType, mangaId, chapterId, filename);
    await putObject(toR2Key(url), file.buffer, file.mimetype);
    await client.query(
      "INSERT INTO pages (chapter_id, page_number, image_path) VALUES ($1, $2, $3)",
      [chapterId, pageNumber, url]
    );
  }
}

module.exports = { savePageFiles };

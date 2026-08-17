const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { chapterDir, chapterPageUrl } = require("./mangaStorage");

// Pages live under the manga's own folder, keyed by the chapter *number* the
// reader sees rather than the chapter id — so mangaId/chapterNumber, not just
// a chapterId, is what locates them. See utils/mangaStorage.js.
async function savePageFiles(client, { chapterId, workType, mangaId, chapterNumber, files, startPageNumber }) {
  const destDir = chapterDir(workType, mangaId, chapterNumber);
  await fs.mkdir(destDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageNumber = startPageNumber + i;
    // Extension is derived from the file's real magic bytes, not the
    // client-supplied originalname/mimetype — see utils/imageValidation.js.
    const ext = await detectImageExtension(file.buffer);
    const filename = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(destDir, filename), file.buffer);
    await client.query(
      "INSERT INTO pages (chapter_id, page_number, image_path) VALUES ($1, $2, $3)",
      [chapterId, pageNumber, chapterPageUrl(workType, mangaId, chapterNumber, filename)]
    );
  }
}

module.exports = { savePageFiles };

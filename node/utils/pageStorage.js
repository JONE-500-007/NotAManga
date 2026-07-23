const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");

async function savePageFiles(client, { chapterId, chapterDir, files, startPageNumber }) {
  await fs.mkdir(chapterDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageNumber = startPageNumber + i;
    // Extension is derived from the file's real magic bytes, not the
    // client-supplied originalname/mimetype — see utils/imageValidation.js.
    const ext = await detectImageExtension(file.buffer);
    const filename = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(chapterDir, filename), file.buffer);
    await client.query(
      "INSERT INTO pages (chapter_id, page_number, image_path) VALUES ($1, $2, $3)",
      [chapterId, pageNumber, `/uploads/pages/${chapterId}/${filename}`]
    );
  }
}

module.exports = { savePageFiles };

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

async function savePageFiles(client, { chapterId, chapterDir, files, startPageNumber }) {
  await fs.mkdir(chapterDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageNumber = startPageNumber + i;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filename = `${crypto.randomUUID()}-${safeName}`;
    await fs.writeFile(path.join(chapterDir, filename), file.buffer);
    await client.query(
      "INSERT INTO pages (chapter_id, page_number, image_path) VALUES ($1, $2, $3)",
      [chapterId, pageNumber, `/uploads/pages/${chapterId}/${filename}`]
    );
  }
}

module.exports = { savePageFiles };

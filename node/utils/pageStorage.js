const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { chapterPageUrl } = require("./mangaStorage");
const { putObject, toR2Key } = require("./r2Client");

// Pages live under the chapter's own R2 key prefix, keyed by chapter *id*
// (immutable) rather than the reader-facing chapter number — see
// utils/mangaStorage.js for why.
//
// R2 uploads run in small concurrent batches rather than one-at-a-time —
// each PUT is an independent network round-trip to R2, so a 40+ page
// chapter uploaded sequentially spent tens of seconds doing nothing but
// waiting on latency. client.query() calls stay safe to fire without
// awaiting between them: node-postgres queues queries on a single
// connection and runs them in submission order, so the DB writes don't
// actually run concurrently even though this loop doesn't wait for one
// INSERT before starting the next file's upload.
const UPLOAD_CONCURRENCY = 6;

async function savePageFiles(client, { chapterId, workType, mangaId, files, startPageNumber }) {
  async function saveOne(i) {
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

  for (let start = 0; start < files.length; start += UPLOAD_CONCURRENCY) {
    const batch = [];
    for (let i = start; i < Math.min(start + UPLOAD_CONCURRENCY, files.length); i++) {
      batch.push(saveOne(i));
    }
    await Promise.all(batch);
  }
}

module.exports = { savePageFiles };

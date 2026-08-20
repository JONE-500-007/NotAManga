const crypto = require("crypto");
const { detectImageExtension } = require("./imageValidation");
const { assertText, MAX_NOVEL_BLOCKS_PER_CHAPTER, MAX_BLOCK_TEXT_LENGTH } = require("./validation");
const { mangaFileUrl, NOVEL } = require("./mangaStorage");
const { putObject, deleteObject, toR2Key } = require("./r2Client");

// Inserts a chapter's ordered content blocks. Each block is either
// {type: "text", content} or {type: "image", existingPath?}. Image blocks
// with no existingPath consume the next file in `files`, in order — this
// is how newly-uploaded images (POST) and newly-added images mixed into an
// edit (PATCH, alongside kept existingPath ones) both get matched up.
//
// blocks is arbitrary parsed JSON from the client (not form fields), so
// nothing guarantees its shape/size on its own — validated upfront, before
// any file is written, so a chapter that fails validation never leaves
// partial files on disk to begin with.
//
// Each new image's extension comes from its real magic bytes (see
// utils/imageValidation.js), never the client-supplied filename/mimetype.
// Files are written here (not by multer) so that check runs first; if a
// later block fails, any files already written by this call are removed
// again since the caller's DB rollback can't undo them.
async function saveNovelBlocks(client, { chapterId, workType, mangaId, blocks, files }) {
  if (blocks.length > MAX_NOVEL_BLOCKS_PER_CHAPTER) {
    const err = new Error(`A chapter can have at most ${MAX_NOVEL_BLOCKS_PER_CHAPTER} content blocks`);
    err.status = 400;
    throw err;
  }
  for (const block of blocks) {
    if (block.type === "text") {
      assertText(block.content, { label: "Chapter content block", max: MAX_BLOCK_TEXT_LENGTH });
    }
  }

  const writtenUrls = [];
  let fileIndex = 0;
  try {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const position = i + 1;

      if (block.type === "text") {
        await client.query(
          "INSERT INTO novel_blocks (chapter_id, position, block_type, content) VALUES ($1, $2, 'text', $3)",
          [chapterId, position, block.content || ""]
        );
      } else if (block.type === "image") {
        let imagePath = block.existingPath;
        if (!imagePath) {
          const file = files[fileIndex++];
          if (!file) throw new Error("Missing image file for an image block");
          const ext = await detectImageExtension(file.buffer);
          const filename = `${crypto.randomUUID()}.${ext}`;
          imagePath = mangaFileUrl(workType, mangaId, NOVEL, filename);
          await putObject(toR2Key(imagePath), file.buffer, file.mimetype);
          writtenUrls.push(imagePath);
        }
        await client.query(
          "INSERT INTO novel_blocks (chapter_id, position, block_type, image_path) VALUES ($1, $2, 'image', $3)",
          [chapterId, position, imagePath]
        );
      } else {
        throw new Error(`Unknown block type: ${block.type}`);
      }
    }
  } catch (err) {
    await Promise.all(writtenUrls.map((url) => deleteObject(toR2Key(url)).catch(() => {})));
    throw err;
  }
}

module.exports = { saveNovelBlocks };

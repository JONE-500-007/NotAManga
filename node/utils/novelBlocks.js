// Inserts a chapter's ordered content blocks. Each block is either
// {type: "text", content} or {type: "image", existingPath?}. Image blocks
// with no existingPath consume the next file in `files`, in order — this
// is how newly-uploaded images (POST) and newly-added images mixed into an
// edit (PATCH, alongside kept existingPath ones) both get matched up.
async function saveNovelBlocks(client, { chapterId, blocks, files }) {
  let fileIndex = 0;
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
        imagePath = `/uploads/novel-images/${file.filename}`;
      }
      await client.query(
        "INSERT INTO novel_blocks (chapter_id, position, block_type, image_path) VALUES ($1, $2, 'image', $3)",
        [chapterId, position, imagePath]
      );
    } else {
      throw new Error(`Unknown block type: ${block.type}`);
    }
  }
}

module.exports = { saveNovelBlocks };

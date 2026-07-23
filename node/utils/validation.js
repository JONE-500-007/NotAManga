// chapter_number/volume are stored as Postgres NUMERIC (arbitrary-precision
// decimal, not a fixed-width 64-bit integer) so a huge value won't overflow
// or crash the database — but nothing was bounding what a client could send
// either: a non-numeric string reached Postgres as a raw 500 error instead
// of a clean 400, and a value with thousands of digits would be accepted
// and stored forever, bloating that row and whatever page renders it. These
// helpers turn both into an explicit, friendly validation error instead.
const MAX_CHAPTER_NUMBER = 100000;
const MAX_VOLUME_NUMBER = 10000;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 20000;
// A novel chapter's `blocks` array is arbitrary parsed JSON (see
// utils/novelBlocks.js), not form fields, so a text block's `content` could
// be any JSON type/size — these bound both the block count (the insert loop
// is sequential, so an unbounded count is a DoS on that request) and each
// text block's length.
const MAX_NOVEL_BLOCKS_PER_CHAPTER = 1000;
const MAX_BLOCK_TEXT_LENGTH = 20000;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 2000;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// value stays a string/whatever was sent — only used here to validate; the
// original is still what gets passed to the query, so a valid decimal like
// "29.5" keeps its exact formatting instead of round-tripping through a JS
// float.
function assertBoundedNumber(value, { label, max, optional = false }) {
  if (value === undefined || value === null || value === "") {
    if (optional) return;
    throw badRequest(`${label} is required`);
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    throw badRequest(`${label} must be a number between 0 and ${max}`);
  }
}

function assertMaxLength(value, { label, max }) {
  if (typeof value === "string" && value.length > max) {
    throw badRequest(`${label} must be ${max} characters or fewer`);
  }
}

// Like assertMaxLength, but also rejects a present value that isn't a
// string at all — needed for values pulled out of parsed JSON (e.g. a novel
// block's content), which unlike form fields aren't guaranteed to be text.
function assertText(value, { label, max, required = false }) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${label} is required`);
    return;
  }
  if (typeof value !== "string") {
    throw badRequest(`${label} must be text`);
  }
  if (value.length > max) {
    throw badRequest(`${label} must be ${max} characters or fewer`);
  }
}

module.exports = {
  assertBoundedNumber,
  assertMaxLength,
  assertText,
  MAX_CHAPTER_NUMBER,
  MAX_VOLUME_NUMBER,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOVEL_BLOCKS_PER_CHAPTER,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_BIO_LENGTH,
};

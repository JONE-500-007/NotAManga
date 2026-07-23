const multer = require("multer");

// Multer's own limit errors (file size/count/field size, set in
// middleware/upload.js) arrive with no .status, so the generic handler
// below would otherwise report them as a bare 500 with a terse message
// ("File too large") instead of a clear 400 the UI can show as-is.
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "That file is too large (max 10MB).",
  LIMIT_FILE_COUNT: "Too many files in this upload.",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field in this upload.",
  LIMIT_PART_COUNT: "This upload has too many parts.",
  LIMIT_FIELD_KEY: "A form field name is too long.",
  LIMIT_FIELD_VALUE: "One of the form fields is too long.",
  LIMIT_FIELD_COUNT: "This form has too many fields.",
};

// Postgres error codes (https://www.postgresql.org/docs/current/errcodes.html)
// worth turning into a plain-language message instead of the raw DB text —
// these are the ones reachable from a route that doesn't already validate
// the value itself (e.g. a malformed id in a URL param).
const POSTGRES_ERROR_MESSAGES = {
  "22P02": "One of the values you entered isn't valid.", // invalid_text_representation
  "22003": "One of the numbers you entered is out of range.", // numeric_value_out_of_range
};

// Turns a caught error into a {status, message} pair safe to send straight
// to the client. Our own validation helpers (utils/validation.js,
// utils/imageValidation.js) already set err.status + a clear err.message,
// so those pass through unchanged; this only translates error shapes that
// come from a library and wouldn't otherwise read as a helpful message.
function toFriendlyError(err) {
  if (err instanceof multer.MulterError) {
    return { status: 400, message: MULTER_ERROR_MESSAGES[err.code] || "That upload could not be processed." };
  }
  if (err.type === "entity.too.large") {
    return { status: 413, message: "That request is too large." };
  }
  if (err.code && POSTGRES_ERROR_MESSAGES[err.code]) {
    return { status: 400, message: POSTGRES_ERROR_MESSAGES[err.code] };
  }
  return { status: err.status || 500, message: err.message || "Internal server error" };
}

module.exports = { toFriendlyError };

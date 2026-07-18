const { DEFAULT_AVATAR_PATH, DEFAULT_BANNER_PATH } = require("../middleware/upload");

const AVATAR_COLUMN = `COALESCE(avatar_path, '${DEFAULT_AVATAR_PATH}') AS avatar_path`;
const BANNER_COLUMN = `COALESCE(banner_path, '${DEFAULT_BANNER_PATH}') AS banner_path`;

// Returned to a user about themselves (includes email/auth_provider, never
// password_hash/google_id).
const SAFE_USER_COLUMNS = `id, username, email, email_verified, display_name, bio, ${AVATAR_COLUMN}, ${BANNER_COLUMN}, role, auth_provider, created_at`;

// Returned about any user to any visitor (no email).
const PUBLIC_USER_COLUMNS = `id, username, display_name, bio, ${AVATAR_COLUMN}, ${BANNER_COLUMN}, role, created_at`;

module.exports = { SAFE_USER_COLUMNS, PUBLIC_USER_COLUMNS };

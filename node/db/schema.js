async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'uploader')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS manga (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      cover_path TEXT,
      uploader_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      chapter_number NUMERIC NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manga_id, chapter_number)
    );

    CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      UNIQUE (chapter_id, page_number)
    );

    CREATE TABLE IF NOT EXISTS art (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      caption TEXT,
      position INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manga_id, position)
    );

    ALTER TABLE chapters ADD COLUMN IF NOT EXISTS volume NUMERIC;

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'uploader', 'admin'));

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS category_manga (
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (category_id, manga_id),
      UNIQUE (category_id, position)
    );

    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_path TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local';

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
    ALTER TABLE users ADD CONSTRAINT users_auth_provider_check CHECK (auth_provider IN ('local', 'google'));

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check;
    ALTER TABLE users ADD CONSTRAINT users_auth_method_check
      CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email)) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique_idx ON users (google_id) WHERE google_id IS NOT NULL;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
    -- Google already confirms the email address, so Google-authenticated
    -- accounts don't need our own verification step.
    UPDATE users SET email_verified = true WHERE auth_provider = 'google' AND email_verified = false;

    -- Drives the reader's default page-spread direction: manga reads
    -- right-to-left, comics/manhwa read left-to-right.
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'manga';
    ALTER TABLE manga DROP CONSTRAINT IF EXISTS manga_format_check;
    ALTER TABLE manga ADD CONSTRAINT manga_format_check CHECK (format IN ('manga', 'comic'));
  `);
}

module.exports = { initSchema };

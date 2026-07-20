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

    -- Lets an admin scale up/down how big a category's cards render on the
    -- browse page (mirrors mangadex.org's per-shelf card size control).
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS card_size TEXT NOT NULL DEFAULT 'medium';
    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_card_size_check;
    ALTER TABLE categories ADD CONSTRAINT categories_card_size_check CHECK (card_size IN ('xs', 'small', 'medium', 'large', 'xl'));

    -- Nullable + UNIQUE so most manga stay on the default auto (upload date)
    -- order; only manga an admin explicitly pins get a position and float
    -- to the front of "All Manga".
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS pinned_position INTEGER UNIQUE;

    -- Single-row table for site-wide display settings that don't belong to
    -- any one category, e.g. the card size of the "All Manga" grid.
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      all_manga_card_size TEXT NOT NULL DEFAULT 'medium',
      CHECK (id = 1)
    );
    INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_all_manga_card_size_check;
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_all_manga_card_size_check
      CHECK (all_manga_card_size IN ('xs', 'small', 'medium', 'large', 'xl'));

    -- Admin-managed global tag list (free-form names, e.g. "Yuri"); uploaders
    -- can only attach/detach existing tags to manga they own, not invent
    -- new ones.
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique_idx ON tags (LOWER(name));

    -- Nullable: unset means the chip falls back to the default accent
    -- styling instead of a custom background.
    ALTER TABLE tags ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_color_check;
    ALTER TABLE tags ADD CONSTRAINT tags_color_check CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$');

    CREATE TABLE IF NOT EXISTS manga_tags (
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (manga_id, tag_id)
    );

    -- VVIP ranks above member (a "supporter" tier) but still below
    -- uploader/admin — it grants no extra permissions on its own, it's just
    -- a role a manga's visible_roles allow-list can target.
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'vvip', 'uploader', 'admin'));

    -- Uploader-controlled visibility. When is_private is true, the manga is
    -- hidden from everyone except its uploader, admins, and any role listed
    -- in manga_visible_roles (an uploader-curated exception list — e.g.
    -- "let VVIP see this but not plain members", or the reverse).
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

    -- Admin "ban" override: when true, is_private is forced true and the
    -- uploader's own visibility endpoint refuses to change it — only an
    -- admin can lift this lock.
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS privacy_locked_by_admin BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS manga_visible_roles (
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('member', 'vvip')),
      PRIMARY KEY (manga_id, role)
    );
  `);
}

module.exports = { initSchema };

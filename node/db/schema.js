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

    -- Lets an admin control the display order of the master tag list, and
    -- an uploader control the order tags appear on their own manga, instead
    -- of both always falling back to alphabetical. Backfills existing rows
    -- to their current alphabetical order so nothing visibly jumps around
    -- the first time this runs against an existing database.
    ALTER TABLE tags ADD COLUMN IF NOT EXISTS position INTEGER;
    UPDATE tags SET position = ranked.rn
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn FROM tags) ranked
      WHERE tags.id = ranked.id AND tags.position IS NULL;
    ALTER TABLE tags ALTER COLUMN position SET NOT NULL;
    ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_position_key;
    ALTER TABLE tags ADD CONSTRAINT tags_position_key UNIQUE (position);

    ALTER TABLE manga_tags ADD COLUMN IF NOT EXISTS position INTEGER;
    UPDATE manga_tags SET position = ranked.rn
      FROM (
        SELECT mt.manga_id, mt.tag_id, ROW_NUMBER() OVER (PARTITION BY mt.manga_id ORDER BY t.name ASC) AS rn
        FROM manga_tags mt JOIN tags t ON t.id = mt.tag_id
      ) ranked
      WHERE manga_tags.manga_id = ranked.manga_id AND manga_tags.tag_id = ranked.tag_id AND manga_tags.position IS NULL;
    ALTER TABLE manga_tags ALTER COLUMN position SET NOT NULL;
    ALTER TABLE manga_tags DROP CONSTRAINT IF EXISTS manga_tags_manga_id_position_key;
    ALTER TABLE manga_tags ADD CONSTRAINT manga_tags_manga_id_position_key UNIQUE (manga_id, position);

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

    -- Lets a private manga's visible_roles allow-list also target "any
    -- uploader" (e.g. sharing a work-in-progress with other uploaders
    -- before it's public), not just member/vvip.
    ALTER TABLE manga_visible_roles DROP CONSTRAINT IF EXISTS manga_visible_roles_role_check;
    ALTER TABLE manga_visible_roles ADD CONSTRAINT manga_visible_roles_role_check
      CHECK (role IN ('member', 'vvip', 'uploader'));

    -- Distinguishes a page-image work (manga/comic — chapters are a
    -- sequence of page images) from a text work (light novel — chapters are
    -- an ordered sequence of text/image blocks, see novel_blocks below).
    -- Independent of "format" (manga/comic reading direction), which only
    -- applies to work_type = 'manga'.
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'manga';
    ALTER TABLE manga DROP CONSTRAINT IF EXISTS manga_work_type_check;
    ALTER TABLE manga ADD CONSTRAINT manga_work_type_check CHECK (work_type IN ('manga', 'novel'));

    -- A light novel chapter's content: an ordered mix of markdown text
    -- blocks and standalone image blocks, e.g. text, image, text, text,
    -- image — reusing the same "chapters" table (numbering/volume/title)
    -- as manga, just with a different content model per row here instead
    -- of the "pages" table.
    CREATE TABLE IF NOT EXISTS novel_blocks (
      id SERIAL PRIMARY KEY,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      block_type TEXT NOT NULL CHECK (block_type IN ('text', 'image')),
      content TEXT,
      image_path TEXT,
      UNIQUE (chapter_id, position)
    );

    -- One rating per (manga, user) on a 5-level scale ("VERY BAAAD" ..
    -- "ABSOLUTE CINEMA") rather than MangaDex's 10.
    CREATE TABLE IF NOT EXISTS manga_ratings (
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (manga_id, user_id)
    );

    -- Raw read-open counter: incremented once per chapter page load
    -- regardless of which chapter, so it reads as the manga's overall
    -- "views" rather than a per-chapter count.
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

    -- A user-curated "read later" collection (MangaDex-style MDList): a
    -- named, optionally-described shelf of manga/novels. is_private controls
    -- whether the list is visible to anyone with its link, not just its
    -- owner (there's no public directory of lists to browse, only direct
    -- links, so this is a lightweight "share or don't" toggle).
    CREATE TABLE IF NOT EXISTS manga_lists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      is_private BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS manga_list_items (
      list_id INTEGER NOT NULL REFERENCES manga_lists(id) ON DELETE CASCADE,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (list_id, manga_id)
    );

    -- Same raw open-counter idea as manga.view_count, but scoped per chapter
    -- — backend-only for now (admin dashboard), not shown to readers.
    ALTER TABLE chapters ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

    -- One row per qualifying chapter-open (see the isOwnerRequest guard where
    -- this is inserted) — a timestamped log alongside the running counters
    -- above, so the admin dashboard can chart views over time instead of
    -- just a lifetime total. Admin-only, never shown to readers.
    CREATE TABLE IF NOT EXISTS view_events (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS view_events_manga_viewed_idx ON view_events (manga_id, viewed_at);
    CREATE INDEX IF NOT EXISTS view_events_viewed_idx ON view_events (viewed_at);

    -- Publication status (MangaDex-style vocabulary). Optional/defaulted so
    -- existing rows don't need backfilling.
    ALTER TABLE manga ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing';
    ALTER TABLE manga DROP CONSTRAINT IF EXISTS manga_status_check;
    ALTER TABLE manga ADD CONSTRAINT manga_status_check
      CHECK (status IN ('ongoing', 'completed', 'hiatus', 'cancelled'));

    -- Ordered list of alternate names (original-language title, regional
    -- releases, etc.) shown under the main title.
    CREATE TABLE IF NOT EXISTS manga_alternative_titles (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE (manga_id, position)
    );

    -- Author(s)/artist(s) credits — a manga can have more than one of
    -- either, so both are an ordered list (kind distinguishes which) rather
    -- than a single text field.
    CREATE TABLE IF NOT EXISTS manga_credits (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('author', 'artist')),
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE (manga_id, kind, position)
    );

    -- One-time migration from the original single author/artist TEXT
    -- columns (each manga's existing value becomes credit #1) — guarded so
    -- it only ever runs once, since the columns it reads are dropped right
    -- after. Re-running this block on a DB that's already past it is a
    -- no-op because the IF condition is false (the columns are gone).
    DO $mig$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'manga' AND column_name = 'author'
      ) THEN
        INSERT INTO manga_credits (manga_id, kind, name, position)
        SELECT id, 'author', author, 1 FROM manga WHERE author IS NOT NULL AND TRIM(author) <> '';
        INSERT INTO manga_credits (manga_id, kind, name, position)
        SELECT id, 'artist', artist, 1 FROM manga WHERE artist IS NOT NULL AND TRIM(artist) <> '';
        ALTER TABLE manga DROP COLUMN author;
        ALTER TABLE manga DROP COLUMN artist;
      END IF;
    END $mig$;

    -- Admin-curated catalog of known "read or buy"/"track" sites (name +
    -- uploaded icon), managed the same way as the global tags list —
    -- uploaders pick from this list when linking their manga to a site
    -- instead of typing a free-form name, so a spammy/misleading link can't
    -- spoof a trusted site's identity.
    CREATE TABLE IF NOT EXISTS link_sites (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('read_or_buy', 'track')),
      icon_path TEXT,
      position INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE link_sites DROP CONSTRAINT IF EXISTS link_sites_category_position_key;
    ALTER TABLE link_sites ADD CONSTRAINT link_sites_category_position_key UNIQUE (category, position);

    -- External links grouped into two rows of icon buttons on the detail
    -- page: "Read or Buy" (official raw/translation, storefronts) and
    -- "Track" (MyAnimeList, AniList, ...). category is denormalized from
    -- site_id's own category at insert time (validated in
    -- utils/mangaSites.js) purely so listing a manga's links doesn't need a
    -- join with link_sites just to split them into the two sections.
    CREATE TABLE IF NOT EXISTS manga_links (
      id SERIAL PRIMARY KEY,
      manga_id INTEGER NOT NULL REFERENCES manga(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK (category IN ('read_or_buy', 'track')),
      url TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE (manga_id, category, position)
    );
    ALTER TABLE manga_links ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES link_sites(id) ON DELETE CASCADE;
    ALTER TABLE manga_links ALTER COLUMN site_id SET NOT NULL;
    ALTER TABLE manga_links DROP COLUMN IF EXISTS site_key;
    ALTER TABLE manga_links DROP COLUMN IF EXISTS custom_label;
  `);
}

module.exports = { initSchema };

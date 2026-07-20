// SQL fragment (+ bound params) for filtering a query's `manga m` rows down
// to what the current viewer is allowed to see. Admins and a manga's own
// uploader always pass; everyone else needs the manga to be public, or
// their role to be on that manga's visible_roles exception list (only
// consulted while the manga is private).
function visibilityFilter(user, paramIndex) {
  const userId = user?.id ?? null;
  const role = user?.role ?? null;
  const p1 = `$${paramIndex}`;
  const p2 = `$${paramIndex + 1}`;
  return {
    clause: `(
      m.is_private = false
      OR m.uploader_id = ${p1}
      OR ${p2} = 'admin'
      OR EXISTS (SELECT 1 FROM manga_visible_roles mvr WHERE mvr.manga_id = m.id AND mvr.role = ${p2})
    )`,
    params: [userId, role],
  };
}

// Same rule, evaluated in JS against an already-fetched manga row (plus its
// visible_roles list) — used for single-manga reads where a WHERE clause
// isn't practical (the row is needed either way to know if it's private).
function canViewManga(user, manga, visibleRoles) {
  if (!manga.is_private) return true;
  if (user?.id === manga.uploader_id) return true;
  if (user?.role === "admin") return true;
  if (user?.role && visibleRoles.includes(user.role)) return true;
  return false;
}

module.exports = { visibilityFilter, canViewManga };

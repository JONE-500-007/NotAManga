const pool = require("../db/pool");

// Append-only history of profile field changes (see user_profile_events in
// db/schema.js). Nothing reads this yet — it's written now because a
// timestamp for "when did this change?" can only be captured at the moment
// it happens, not reconstructed later from the users row.
//
// Recording is best-effort on purpose: a failure here must never turn a
// profile update the user already completed into an error response. The
// write is logged and swallowed rather than propagated.
async function recordProfileChanges(userId, changedBy, changes) {
  const entries = Object.entries(changes).filter(([, { from, to }]) => normalize(from) !== normalize(to));
  if (entries.length === 0) return;

  try {
    for (const [field, { from, to }] of entries) {
      await pool.query(
        `INSERT INTO user_profile_events (user_id, field, old_value, new_value, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, field, from ?? null, to ?? null, changedBy ?? null]
      );
    }
  } catch (err) {
    console.error("Failed to record profile change history:", err);
  }
}

// null, undefined and "" all mean "not set" across these columns, so a
// change between any two of them isn't a change worth logging.
function normalize(value) {
  return value === null || value === undefined ? "" : String(value);
}

module.exports = { recordProfileChanges };

const { badRequest } = require("./validation");

const LINK_CATEGORIES = ["read_or_buy", "track"];
const MAX_LINKS_PER_CATEGORY = 15;
const MAX_URL_LENGTH = 2000;

// Validates the whole `links` array from a manga create/edit request and
// returns it in the normalized shape ready to insert. `siteCategoryById` is
// a Map(site_id -> category) built from the current link_sites catalog
// (admin-managed — see routes/linkSites.routes.js), so a link can only
// reference a site that actually exists and matches the category it's
// filed under; there's no free-form name a client could set. Throws a 400
// on the first problem found. A missing `links` field returns null so
// callers can tell "not provided" apart from "explicitly emptied" ([]).
function validateAndNormalizeLinks(rawLinks, siteCategoryById) {
  if (rawLinks === undefined) return null;
  if (!Array.isArray(rawLinks)) throw badRequest("links must be a list");

  const counts = { read_or_buy: 0, track: 0 };
  return rawLinks.map((link, index) => {
    if (!link || typeof link !== "object") throw badRequest(`links[${index}] is invalid`);
    const { category, site_id: rawSiteId, url } = link;

    if (!LINK_CATEGORIES.includes(category)) {
      throw badRequest(`links[${index}].category must be one of: ${LINK_CATEGORIES.join(", ")}`);
    }
    const siteId = Number(rawSiteId);
    if (!Number.isInteger(siteId) || !siteCategoryById.has(siteId)) {
      throw badRequest(`links[${index}].site_id does not exist`);
    }
    if (siteCategoryById.get(siteId) !== category) {
      throw badRequest(`links[${index}]'s site does not belong to category "${category}"`);
    }
    counts[category] += 1;
    if (counts[category] > MAX_LINKS_PER_CATEGORY) {
      throw badRequest(`No more than ${MAX_LINKS_PER_CATEGORY} links allowed per category`);
    }

    if (typeof url !== "string" || !url.trim()) throw badRequest(`links[${index}] needs a URL`);
    if (url.length > MAX_URL_LENGTH) {
      throw badRequest(`links[${index}]'s URL must be ${MAX_URL_LENGTH} characters or fewer`);
    }
    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw badRequest(`links[${index}] has an invalid URL`);
    }
    // Only http(s) — a link rendered straight into an <a href> could
    // otherwise carry a javascript: URL that runs when clicked.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw badRequest(`links[${index}]'s URL must start with http:// or https://`);
    }

    return { category, site_id: siteId, url: url.trim() };
  });
}

module.exports = { LINK_CATEGORIES, validateAndNormalizeLinks };

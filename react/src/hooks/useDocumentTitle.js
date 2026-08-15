import { useEffect } from "react";

const SITE_NAME = "NotAManga";

// Google (and every other search engine) reads the raw <title>/meta tags a
// page ships, not just what's visually on screen — a SPA that never touches
// document.title leaves every route indexed under the same generic title.
// Resets to the site name on unmount so navigating to an untitled route
// (e.g. back to Browse) doesn't keep a stale title from the previous page.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = SITE_NAME;
    };
  }, [title]);
}

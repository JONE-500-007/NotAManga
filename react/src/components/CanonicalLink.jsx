import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// The one address Google should index each page under. Without it, the same
// page reached as http:// vs https://, or with a ?query/#hash tacked on, gets
// reported in Search Console as "Duplicate without user-selected canonical".
// Hardcoded for the same reason as og:url in index.html: it must be the
// public absolute URL, whatever host/scheme this particular request used.
const CANONICAL_ORIGIN = "https://www.justsomemanga.com";

export default function CanonicalLink() {
  const { pathname } = useLocation();

  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
    link.href = `${CANONICAL_ORIGIN}${path}`;
  }, [pathname]);

  return null;
}

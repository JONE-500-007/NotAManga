import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown } from "../utils/renderMarkdown";

// Debounced live search against /admin/stats/search — used both for the
// dashboard's "jump to a title" box and the per-manga "compare with" picker.
// Results aren't preloaded (there could be hundreds of titles), so this
// queries the backend as the admin types instead of filtering a local list.
export default function AdminMangaSearch({ placeholder, onSelect, excludeId }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api
        .get(`/admin/stats/search?q=${encodeURIComponent(trimmed)}`)
        .then((rows) => setResults(rows.filter((r) => r.id !== excludeId)))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, excludeId]);

  const handleSelect = (manga) => {
    onSelect(manga);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="admin-search" ref={containerRef}>
      <span className="material-symbols-outlined admin-search-icon" aria-hidden="true">
        search
      </span>
      <input
        type="search"
        className="admin-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && query.trim() && (
        <div className="admin-search-panel">
          {loading ? (
            <p className="admin-search-status">{t("common.loading")}</p>
          ) : results.length === 0 ? (
            <p className="admin-search-status">{t("admin.dashboard.noResults")}</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                className="admin-search-result"
                onClick={() => handleSelect(m)}
              >
                {m.cover_path ? (
                  <img src={m.cover_path} alt="" />
                ) : (
                  <div className="admin-search-result-placeholder" />
                )}
                <span className="admin-search-result-info">
                  <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.title) }} />
                  <span className="dashboard-rank-meta">
                    {t(`admin.dashboard.workType.${m.work_type}`)} · {m.view_count.toLocaleString()}{" "}
                    {t("detail.views")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

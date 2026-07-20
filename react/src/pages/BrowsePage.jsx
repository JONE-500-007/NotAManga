import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import MangaCard from "../components/MangaCard";

export default function BrowsePage() {
  const { t } = useLanguage();
  const [manga, setManga] = useState(null);
  const [categories, setCategories] = useState(null);
  const [allMangaCardSize, setAllMangaCardSize] = useState("medium");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.get("/manga").then(setManga).catch(() => setManga([]));
    api.get("/categories").then(setCategories).catch(() => setCategories([]));
    api.get("/settings").then((s) => setAllMangaCardSize(s.all_manga_card_size)).catch(() => {});
  }, []);

  if (manga === null || categories === null) return <div className="page-loading">{t("common.loading")}</div>;

  const shelves = categories.filter((c) => c.manga.length > 0);
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const searchResults = isSearching
    ? manga.filter(
        (m) =>
          m.title.toLowerCase().includes(trimmedQuery) ||
          (m.tags || []).some((tg) => tg.name.toLowerCase().includes(trimmedQuery))
      )
    : [];

  return (
    <div className="page browse-page">
      <div className="browse-search">
        <input
          type="search"
          className="browse-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("browse.searchPlaceholder")}
        />
      </div>

      {isSearching ? (
        <section>
          <h2>{t("browse.searchResults")}</h2>
          {searchResults.length === 0 ? (
            <p className="empty-state">{t("browse.searchEmpty")}</p>
          ) : (
            <div className="manga-grid">
              {searchResults.map((m) => (
                <MangaCard key={m.id} manga={m} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {shelves.map((category) => (
            <section key={category.id} className="shelf">
              <div className="shelf-header">
                <h2 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(category.title) }} />
              </div>
              {category.description && (
                <div
                  className="shelf-description"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(category.description) }}
                />
              )}
              <div className={`shelf-scroll shelf-scroll--${category.card_size || "medium"}`}>
                {category.manga.map((m) => (
                  <MangaCard key={m.id} manga={m} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2>{shelves.length > 0 ? t("browse.allManga") : t("browse.title")}</h2>
            {manga.length === 0 ? (
              <p className="empty-state">{t("browse.empty")}</p>
            ) : (
              <div className={`manga-grid manga-grid--${allMangaCardSize}`}>
                {manga.map((m) => (
                  <MangaCard key={m.id} manga={m} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

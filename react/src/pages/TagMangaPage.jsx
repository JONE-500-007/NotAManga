import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown } from "../utils/renderMarkdown";
import MangaCard from "../components/MangaCard";

export default function TagMangaPage() {
  const { tagId } = useParams();
  const { t } = useLanguage();
  const [tag, setTag] = useState(null);

  useEffect(() => {
    setTag(null);
    api.get(`/tags/${tagId}`).then(setTag);
  }, [tagId]);

  if (!tag) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div className="page tag-manga-page">
      <Link to="/" className="btn btn-ghost btn-sm">
        &larr; {t("browse.title")}
      </Link>

      <h1>
        {t("tags.tagPrefix")} <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(tag.name) }} />
      </h1>

      {tag.manga.length === 0 ? (
        <p className="empty-state">{t("tags.empty")}</p>
      ) : (
        <div className="manga-grid manga-grid--medium">
          {tag.manga.map((m) => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  );
}

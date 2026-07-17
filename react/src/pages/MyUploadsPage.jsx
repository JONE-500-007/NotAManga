import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import MangaCard from "../components/MangaCard";

export default function MyUploadsPage() {
  const { t } = useLanguage();
  const [manga, setManga] = useState(null);

  useEffect(() => {
    api.get("/manga/mine").then(setManga).catch(() => setManga([]));
  }, []);

  if (manga === null) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div className="page">
      <h1>{t("myUploads.title")}</h1>
      {manga.length === 0 ? (
        <p className="empty-state">{t("myUploads.empty")}</p>
      ) : (
        <div className="manga-grid">
          {manga.map((m) => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  );
}

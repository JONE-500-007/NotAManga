import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import UploadChapterPage from "./UploadChapterPage";
import UploadNovelChapterPage from "./UploadNovelChapterPage";

// Manga and light novel chapters live under the same URL — this just picks
// which upload form to render based on the parent work's type.
export default function UploadChapterRouter() {
  const { mangaId } = useParams();
  const { t } = useLanguage();
  const [workType, setWorkType] = useState(null);

  useEffect(() => {
    setWorkType(null);
    api.get(`/manga/${mangaId}`).then((data) => setWorkType(data.work_type));
  }, [mangaId]);

  if (!workType) return <div className="page-loading">{t("common.loading")}</div>;
  return workType === "novel" ? <UploadNovelChapterPage /> : <UploadChapterPage />;
}

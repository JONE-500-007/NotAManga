import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import ReaderPage from "./ReaderPage";
import NovelReaderPage from "./NovelReaderPage";

export default function ChapterReaderRouter() {
  const { mangaId } = useParams();
  const { t } = useLanguage();
  const [workType, setWorkType] = useState(null);

  useEffect(() => {
    setWorkType(null);
    api.get(`/manga/${mangaId}`).then((data) => setWorkType(data.work_type));
  }, [mangaId]);

  if (!workType) return <div className="page-loading">{t("common.loading")}</div>;
  return workType === "novel" ? <NovelReaderPage /> : <ReaderPage />;
}

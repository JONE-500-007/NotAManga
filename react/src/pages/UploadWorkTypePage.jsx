import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function UploadWorkTypePage() {
  const { t } = useLanguage();

  return (
    <div className="page upload-picker-page">
      <h1>{t("uploadWork.title")}</h1>

      <div className="upload-type-grid">
        <Link to="/upload/manga" className="upload-type-card">
          <span className="material-symbols-outlined">auto_stories</span>
          <h2>{t("uploadWork.manga")}</h2>
          <p>{t("uploadWork.mangaDesc")}</p>
        </Link>
        <Link to="/upload/novel" className="upload-type-card">
          <span className="material-symbols-outlined">menu_book</span>
          <h2>{t("uploadWork.novel")}</h2>
          <p>{t("uploadWork.novelDesc")}</p>
        </Link>
      </div>
    </div>
  );
}

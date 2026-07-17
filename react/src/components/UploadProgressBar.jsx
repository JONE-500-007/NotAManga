import { useLanguage } from "../context/LanguageContext";

export default function UploadProgressBar({ percent }) {
  const { t } = useLanguage();

  return (
    <div className="upload-progress">
      <div className="upload-progress-track">
        <div className="upload-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="upload-progress-label">
        {t("common.uploading")} {percent}%
      </span>
    </div>
  );
}

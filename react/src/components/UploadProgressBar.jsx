import { useLanguage } from "../context/LanguageContext";

// Two bars because they measure two different things. The first tracks the
// browser->server request body (xhr.upload.onprogress) and reaches 100% as
// soon as the files have reached our VPS. The second has no real percentage
// to report — the server is still relaying each file on to R2 storage after
// that, which the browser can't observe — so it just switches from idle to
// an indeterminate sweep once the first bar completes, instead of lying
// with a fake number.
export default function UploadProgressBar({ percent }) {
  const { t } = useLanguage();
  const saving = percent >= 100;

  return (
    <div className="upload-progress-group">
      <div className="upload-progress-step">
        <div className="upload-progress">
          <div className="upload-progress-track">
            <div className="upload-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="upload-progress-label">
            {t("common.uploading")} {percent}%
          </span>
        </div>
        <p className="upload-progress-hint">{t("common.uploadingHint")}</p>
      </div>

      <div className="upload-progress-step">
        <div className="upload-progress">
          <div className="upload-progress-track">
            <div
              className={`upload-progress-fill-indeterminate${saving ? " upload-progress-fill-indeterminate-active" : ""}`}
            />
          </div>
          <span className="upload-progress-label">{t("common.savingToStorage")}</span>
        </div>
        <p className="upload-progress-hint">{t("common.savingToStorageHint")}</p>
      </div>
    </div>
  );
}

import { useLanguage } from "../context/LanguageContext";

export default function ReaderSettingsPanel({
  settings,
  setMode,
  setDoublePage,
  setDirection,
  setShowProgress,
  onClose,
}) {
  const { t } = useLanguage();

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel-header">
          <h2>{t("reader.settings")}</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("reader.readingMode")}</span>
          <div className="settings-toggle-group">
            <button
              className={settings.mode === "paged" ? "active" : ""}
              onClick={() => setMode("paged")}
            >
              {t("reader.paged")}
            </button>
            <button
              className={settings.mode === "longStrip" ? "active" : ""}
              onClick={() => setMode("longStrip")}
            >
              {t("reader.longStrip")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("reader.doublePage")}</span>
          <div className="settings-toggle-group">
            <button
              className={!settings.doublePage ? "active" : ""}
              onClick={() => setDoublePage(false)}
            >
              {t("reader.paged")}
            </button>
            <button
              className={settings.doublePage ? "active" : ""}
              onClick={() => setDoublePage(true)}
            >
              {t("reader.doublePage")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("reader.direction")}</span>
          <div className="settings-toggle-group">
            <button
              className={settings.direction === "ltr" ? "active" : ""}
              onClick={() => setDirection("ltr")}
            >
              {t("reader.ltr")}
            </button>
            <button
              className={settings.direction === "rtl" ? "active" : ""}
              onClick={() => setDirection("rtl")}
            >
              {t("reader.rtl")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("reader.showProgress")}</span>
          <div className="settings-toggle-group">
            <button
              className={settings.showProgress ? "active" : ""}
              onClick={() => setShowProgress(true)}
            >
              {t("common.on")}
            </button>
            <button
              className={!settings.showProgress ? "active" : ""}
              onClick={() => setShowProgress(false)}
            >
              {t("common.off")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLanguage } from "../context/LanguageContext";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_BUTTON_STEP, ZOOM_SLIDER_STEP } from "../hooks/useReaderSettings";

export default function ReaderSettingsPanel({
  settings,
  setMode,
  setDoublePage,
  setDirection,
  setShowProgress,
  setZoom,
  onClose,
}) {
  const { t } = useLanguage();
  const zoomFillPercent = ((settings.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100;

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

        <div className="settings-row settings-row-doublepage">
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

        <div className="settings-row settings-row-zoom">
          <span className="settings-label">
            {t("reader.zoom")} ({settings.zoom}%)
          </span>
          <div className="zoom-control">
            <button
              type="button"
              className="btn btn-ghost btn-sm zoom-reset-btn"
              onClick={() => setZoom(100)}
              disabled={settings.zoom === 100}
            >
              {t("common.reset")}
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setZoom(settings.zoom - ZOOM_BUTTON_STEP)}
              disabled={settings.zoom <= ZOOM_MIN}
              aria-label={t("reader.zoomOut")}
            >
              &minus;
            </button>
            <input
              type="range"
              className="zoom-slider"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_SLIDER_STEP}
              value={settings.zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label={t("reader.zoom")}
              style={{
                background: `linear-gradient(to right, var(--accent) ${zoomFillPercent}%, var(--border) ${zoomFillPercent}%)`,
              }}
            />
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setZoom(settings.zoom + ZOOM_BUTTON_STEP)}
              disabled={settings.zoom >= ZOOM_MAX}
              aria-label={t("reader.zoomIn")}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

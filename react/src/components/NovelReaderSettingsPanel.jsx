import { useLanguage } from "../context/LanguageContext";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from "../hooks/useNovelReaderSettings";

export default function NovelReaderSettingsPanel({ settings, setTheme, setFontSize, setFontFamily, onClose }) {
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
          <span className="settings-label">{t("novelReader.theme")}</span>
          <div className="settings-toggle-group">
            <button className={settings.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
              {t("novelReader.themeDark")}
            </button>
            <button className={settings.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
              {t("novelReader.themeLight")}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">
            {t("novelReader.fontSize")} ({settings.fontSize}px)
          </span>
          <div className="zoom-control">
            <button
              type="button"
              className="btn btn-ghost btn-sm zoom-reset-btn"
              onClick={() => setFontSize(FONT_SIZE_DEFAULT)}
              disabled={settings.fontSize === FONT_SIZE_DEFAULT}
            >
              {t("common.reset")}
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setFontSize(settings.fontSize - 1)}
              disabled={settings.fontSize <= FONT_SIZE_MIN}
              aria-label={t("novelReader.fontSizeSmaller")}
            >
              &minus;
            </button>
            <input
              type="range"
              className="zoom-slider"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={settings.fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              aria-label={t("novelReader.fontSize")}
              style={{
                background: `linear-gradient(to right, var(--accent) ${
                  ((settings.fontSize - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN)) * 100
                }%, var(--border) ${
                  ((settings.fontSize - FONT_SIZE_MIN) / (FONT_SIZE_MAX - FONT_SIZE_MIN)) * 100
                }%)`,
              }}
            />
            <button
              type="button"
              className="zoom-btn"
              onClick={() => setFontSize(settings.fontSize + 1)}
              disabled={settings.fontSize >= FONT_SIZE_MAX}
              aria-label={t("novelReader.fontSizeLarger")}
            >
              +
            </button>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("novelReader.fontFamily")}</span>
          <select
            className="novel-font-select"
            value={settings.fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            <option value="default">{t("novelReader.fontDefault")}</option>
            <option value="k2d">K2D</option>
            <option value="chakraPetch">Chakra Petch</option>
            <option value="ibmPlexSansThai">IBM Plex Sans Thai</option>
            <option value="sarabun">Sarabun</option>
          </select>
        </div>
      </div>
    </div>
  );
}

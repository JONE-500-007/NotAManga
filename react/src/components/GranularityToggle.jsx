import { useLanguage } from "../context/LanguageContext";

const UNITS = ["day", "week", "month"];

export default function GranularityToggle({ value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="settings-toggle-group dashboard-granularity-toggle">
      {UNITS.map((unit) => (
        <button
          key={unit}
          type="button"
          className={value === unit ? "active" : ""}
          onClick={() => onChange(unit)}
        >
          {t(`admin.dashboard.unit.${unit}`)}
        </button>
      ))}
    </div>
  );
}

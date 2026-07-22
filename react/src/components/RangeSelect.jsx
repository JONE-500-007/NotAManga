import { useLanguage } from "../context/LanguageContext";
import { RANGE_PRESETS } from "../utils/rangePresets";

export default function RangeSelect({ unit, count, onChange }) {
  const { t } = useLanguage();
  return (
    <select
      className="dashboard-range-select"
      value={count}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {RANGE_PRESETS[unit].map((n) => (
        <option key={n} value={n}>
          {n} {t(`admin.dashboard.unit.${unit}Plural`)}
        </option>
      ))}
    </select>
  );
}

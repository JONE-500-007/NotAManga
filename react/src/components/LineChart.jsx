import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const WIDTH = 600;
const PADDING = { top: 12, right: 12, bottom: 30, left: 34 };

// Rounds a max value up to a "nice" round number (1/2/5 * 10^n) so gridlines
// read as 0 / 25 / 50 instead of 0 / 17.3 / 34.6.
function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let step;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function formatAxisDate(dateStr, granularity, locale) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (granularity === "month") return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// A single- or dual-series views-over-time line chart. `series` is
// [{ key, label, color, data: [{ date, views }] }] — all series must share
// the same date axis (the admin trend endpoints always return a contiguous
// range for the given granularity, so two series fetched with the same
// `unit` line up). `granularity` ("day" | "week" | "month") only affects
// axis-label formatting; the data itself is already bucketed server-side.
export default function LineChart({ series, height = 220, granularity = "day" }) {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "th" ? "th-TH" : "en-US";
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const dates = series[0]?.data.map((d) => d.date) || [];
  const n = dates.length;

  useEffect(() => {
    setRevealed(false);
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, [series]);

  const maxValue = useMemo(() => {
    const rawMax = Math.max(1, ...series.flatMap((s) => s.data.map((d) => d.views)));
    return niceMax(rawMax);
  }, [series]);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const xFor = (i) => PADDING.left + (n <= 1 ? 0 : (i / (n - 1)) * plotWidth);
  const yFor = (v) => PADDING.top + plotHeight - (v / maxValue) * plotHeight;

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const index = Math.round(fraction * (n - 1));
    setHoverIndex(Math.min(Math.max(index, 0), n - 1));
  };

  if (n === 0) return <p className="empty-state">{t("admin.dashboard.noData")}</p>;

  return (
    <div className="line-chart">
      <div className="line-chart-toolbar">
        {series.length > 1 && (
          <ul className="line-chart-legend">
            {series.map((s) => (
              <li key={s.key}>
                <span className="line-chart-legend-key" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="line-chart-table-toggle" onClick={() => setShowTable((v) => !v)}>
          {showTable ? t("admin.dashboard.showChart") : t("admin.dashboard.showTable")}
        </button>
      </div>

      {showTable ? (
        <div className="line-chart-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>{t("admin.dashboard.date")}</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, i) => (
                <tr key={date}>
                  <td>{date}</td>
                  {series.map((s) => (
                    <td key={s.key}>{s.data[i]?.views ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="line-chart-plot">
          <svg viewBox={`0 0 ${WIDTH} ${height}`} className="line-chart-svg" preserveAspectRatio="none">
            {gridSteps.map((step) => {
              const y = PADDING.top + plotHeight * (1 - step);
              return (
                <line
                  key={step}
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  className="line-chart-gridline"
                />
              );
            })}
            {gridSteps.map((step, i) => {
              const value = Math.round(maxValue * step);
              const prevValue = i > 0 ? Math.round(maxValue * gridSteps[i - 1]) : null;
              if (value === prevValue) return null;
              return (
                <text key={step} x={PADDING.left - 8} y={PADDING.top + plotHeight * (1 - step) + 3} className="line-chart-axis-label" textAnchor="end">
                  {value.toLocaleString()}
                </text>
              );
            })}
            {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
              <text key={i} x={xFor(i)} y={height - 6} className="line-chart-axis-label" textAnchor="middle">
                {formatAxisDate(dates[i], granularity, dateLocale)}
              </text>
            ))}

            {series.map((s) => {
              const path = s.data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.views)}`).join(" ");
              return (
                <path
                  key={s.key}
                  d={path}
                  className={`line-chart-line${revealed ? " line-chart-line-revealed" : ""}`}
                  style={{ stroke: s.color }}
                />
              );
            })}

            {hoverIndex !== null && (
              <line
                x1={xFor(hoverIndex)}
                x2={xFor(hoverIndex)}
                y1={PADDING.top}
                y2={height - PADDING.bottom}
                className="line-chart-crosshair"
              />
            )}

            {series.map((s) =>
              hoverIndex !== null ? (
                <circle
                  key={s.key}
                  cx={xFor(hoverIndex)}
                  cy={yFor(s.data[hoverIndex]?.views ?? 0)}
                  r={4}
                  className="line-chart-dot"
                  style={{ fill: s.color }}
                />
              ) : null
            )}

            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          {hoverIndex !== null && (
            <div
              className="line-chart-tooltip"
              style={{ left: `${n <= 1 ? 0 : (hoverIndex / (n - 1)) * 100}%` }}
            >
              <div className="line-chart-tooltip-date">{formatAxisDate(dates[hoverIndex], granularity, dateLocale)}</div>
              {series.map((s) => (
                <div key={s.key} className="line-chart-tooltip-row">
                  <span className="line-chart-legend-key" style={{ background: s.color }} />
                  <span className="line-chart-tooltip-value">{s.data[hoverIndex]?.views ?? 0}</span>
                  {series.length > 1 && <span className="line-chart-tooltip-label">{s.label}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useCountUp } from "../hooks/useCountUp";
import { renderInlineMarkdown } from "../utils/renderMarkdown";
import LineChart from "../components/LineChart";
import AdminMangaSearch from "../components/AdminMangaSearch";
import GranularityToggle from "../components/GranularityToggle";
import RangeSelect from "../components/RangeSelect";
import { DEFAULT_RANGE_COUNT } from "../utils/rangePresets";

function StatCard({ label, value, formatted }) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  return (
    <div className="dashboard-stat-card dashboard-animate-in">
      <span className="dashboard-stat-value">{formatted ?? animated.toLocaleString()}</span>
      <span className="dashboard-stat-label">{label}</span>
    </div>
  );
}

export default function AdminMangaStatsPage() {
  const { mangaId } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [trend, setTrend] = useState(null);
  const [compareManga, setCompareManga] = useState(null);
  const [compareTrend, setCompareTrend] = useState(null);
  const [chapterQuery, setChapterQuery] = useState("");
  const [granularity, setGranularity] = useState("day");
  const [rangeCount, setRangeCount] = useState(DEFAULT_RANGE_COUNT.day);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setCompareManga(null);
    setChapterQuery("");
    api
      .get(`/admin/stats/manga/${mangaId}`)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [mangaId]);

  useEffect(() => {
    setTrend(null);
    api.get(`/admin/stats/manga/${mangaId}/trend?unit=${granularity}&count=${rangeCount}`).then(setTrend);
  }, [mangaId, granularity, rangeCount]);

  useEffect(() => {
    if (!compareManga) {
      setCompareTrend(null);
      return;
    }
    setCompareTrend(null);
    api
      .get(`/admin/stats/manga/${compareManga.id}/trend?unit=${granularity}&count=${rangeCount}`)
      .then(setCompareTrend);
  }, [compareManga, granularity, rangeCount]);

  const handleGranularityChange = (unit) => {
    setGranularity(unit);
    setRangeCount(DEFAULT_RANGE_COUNT[unit]);
  };

  if (notFound) return <div className="page-loading">{t("admin.dashboard.notFound")}</div>;
  if (!data) return <div className="page-loading">{t("common.loading")}</div>;

  const trimmedChapterQuery = chapterQuery.trim().toLowerCase();
  const visibleChapters = trimmedChapterQuery
    ? data.chapters.filter(
        (c) =>
          String(c.chapter_number).toLowerCase().includes(trimmedChapterQuery) ||
          (c.title || "").toLowerCase().includes(trimmedChapterQuery)
      )
    : data.chapters;

  // Chapters come back ordered by chapter_number, so walking them in order
  // groups each volume's chapters together and keeps the volumes themselves
  // in reading order. Chapters with no volume set collect under a null key,
  // rendered last as "No Volume" rather than being dropped.
  const volumeGroups = [];
  for (const chapter of data.chapters) {
    const key = chapter.volume ?? null;
    const existing = volumeGroups.find((g) => g.volume === key);
    if (existing) existing.chapters.push(chapter);
    else volumeGroups.push({ volume: key, chapters: [chapter] });
  }
  volumeGroups.sort((a, b) => {
    if (a.volume === null) return 1;
    if (b.volume === null) return -1;
    return Number(a.volume) - Number(b.volume);
  });
  const numberedVolumeCount = volumeGroups.filter((g) => g.volume !== null).length;

  const chartSeries = [
    { key: "primary", label: data.title.replace(/<[^>]+>/g, ""), color: "var(--accent)", data: trend || [] },
  ];
  if (compareManga && compareTrend) {
    chartSeries.push({
      key: "compare",
      label: compareManga.title.replace(/<[^>]+>/g, ""),
      color: "#3987e5",
      data: compareTrend,
    });
  }

  return (
    <div className="page admin-manga-stats-page">
      <h1 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(data.title) }} />
      <p className="dashboard-activity-meta">
        {t(`admin.dashboard.workType.${data.work_type}`)} · {t("detail.by")}{" "}
        {data.uploader_display_name || data.uploader_username} · {t("admin.dashboard.uploaded")}{" "}
        {new Date(data.created_at).toLocaleString()}
      </p>

      <div className="dashboard-stat-grid">
        <StatCard label={t("admin.dashboard.totalViews")} value={data.view_count} />
        <StatCard
          label={`${t("admin.dashboard.avgRating")} (${data.rating_count})`}
          value={data.rating_average}
          formatted={data.rating_count > 0 ? data.rating_average.toFixed(1) : "—"}
        />
        <StatCard label={t("admin.dashboard.totalChapters")} value={data.chapters.length} />
        <StatCard label={t("admin.dashboard.totalVolumes")} value={numberedVolumeCount} />
      </div>

      {volumeGroups.length > 0 && (
        <section className="dashboard-section admin-volume-section">
          <h2>{t("admin.dashboard.volumeBreakdown")}</h2>
          <ul className="admin-volume-list">
            {volumeGroups.map((group) => {
              const first = group.chapters[0];
              const last = group.chapters[group.chapters.length - 1];
              const views = group.chapters.reduce((sum, c) => sum + c.view_count, 0);
              return (
                <li key={group.volume ?? "none"} className="admin-volume-item">
                  <span className="admin-volume-name">
                    {group.volume === null
                      ? t("admin.dashboard.noVolume")
                      : `${t("detail.volume")} ${group.volume}`}
                  </span>
                  <span className="admin-volume-meta">
                    {group.chapters.length} {t("detail.chapters")} · Ch. {first.chapter_number}
                    {first.id !== last.id ? `–${last.chapter_number}` : ""}
                  </span>
                  <span className="admin-volume-views">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      visibility
                    </span>
                    {views.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="dashboard-section dashboard-trend-section">
        <div className="dashboard-trend-header">
          <h2>{t("admin.dashboard.viewsOverTime")}</h2>
          <div className="dashboard-trend-controls">
            <RangeSelect unit={granularity} count={rangeCount} onChange={setRangeCount} />
            <GranularityToggle value={granularity} onChange={handleGranularityChange} />
            <AdminMangaSearch
              placeholder={t("admin.dashboard.compareWith")}
              excludeId={Number(mangaId)}
              onSelect={setCompareManga}
            />
          </div>
        </div>
        {compareManga && (
          <p className="dashboard-compare-hint">
            {t("admin.dashboard.comparing")}{" "}
            <strong dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(compareManga.title) }} />
            <button type="button" className="dashboard-compare-clear" onClick={() => setCompareManga(null)}>
              &times;
            </button>
          </p>
        )}
        {trend ? (
          <LineChart series={chartSeries} granularity={granularity} />
        ) : (
          <p className="empty-state">{t("common.loading")}</p>
        )}
      </section>

      {data.most_viewed_chapter && (
        <p className="dashboard-highlight">
          {t("admin.dashboard.mostViewedChapter")}: <strong>Ch. {data.most_viewed_chapter.chapter_number}</strong>
          {data.most_viewed_chapter.title ? ` — ${data.most_viewed_chapter.title}` : ""} (
          {data.most_viewed_chapter.view_count.toLocaleString()} {t("detail.views")})
        </p>
      )}

      {data.chapters.length === 0 ? (
        <p className="empty-state">{t("admin.dashboard.noChapters")}</p>
      ) : (
        <>
          {data.chapters.length > 5 && (
            <input
              type="search"
              className="browse-search-input dashboard-chapter-search"
              value={chapterQuery}
              onChange={(e) => setChapterQuery(e.target.value)}
              placeholder={t("admin.dashboard.searchChapters")}
            />
          )}
          {visibleChapters.length === 0 ? (
            <p className="empty-state">{t("admin.dashboard.noResults")}</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t("detail.chapters")}</th>
                  <th>{t("detail.volume")}</th>
                  <th>{t("admin.dashboard.uploaded")}</th>
                  <th>{t("detail.views")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleChapters.map((c) => (
                  <tr
                    key={c.id}
                    className={data.most_viewed_chapter?.id === c.id ? "dashboard-table-row-highlight" : ""}
                  >
                    <td>
                      Ch. {c.chapter_number}
                      {c.title ? ` — ${c.title}` : ""}
                    </td>
                    <td>{c.volume != null ? c.volume : "—"}</td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                    <td>{c.view_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

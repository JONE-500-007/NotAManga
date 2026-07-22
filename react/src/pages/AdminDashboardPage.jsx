import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useCountUp } from "../hooks/useCountUp";
import { renderInlineMarkdown } from "../utils/renderMarkdown";
import LineChart from "../components/LineChart";
import AdminMangaSearch from "../components/AdminMangaSearch";
import GranularityToggle from "../components/GranularityToggle";
import RangeSelect from "../components/RangeSelect";
import { DEFAULT_RANGE_COUNT } from "../utils/rangePresets";

const ROLE_COLORS = {
  member: "#d95926",
  vvip: "#3987e5",
  uploader: "#008300",
  admin: "#9085e9",
};

function StatCard({ label, value }) {
  const animated = useCountUp(value);
  return (
    <div className="dashboard-stat-card dashboard-animate-in">
      <span className="dashboard-stat-value">{animated.toLocaleString()}</span>
      <span className="dashboard-stat-label">{label}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [granularity, setGranularity] = useState("day");
  const [rangeCount, setRangeCount] = useState(DEFAULT_RANGE_COUNT.day);

  useEffect(() => {
    api.get("/admin/stats").then(setStats);
  }, []);

  useEffect(() => {
    setTrend(null);
    api.get(`/admin/stats/trend?unit=${granularity}&count=${rangeCount}`).then(setTrend);
  }, [granularity, rangeCount]);

  const handleGranularityChange = (unit) => {
    setGranularity(unit);
    setRangeCount(DEFAULT_RANGE_COUNT[unit]);
  };

  if (!stats) return <div className="page-loading">{t("common.loading")}</div>;

  const statCards = [
    { key: "totalManga", label: t("admin.dashboard.totalManga"), value: stats.total_manga },
    { key: "totalNovels", label: t("admin.dashboard.totalNovels"), value: stats.total_novels },
    { key: "totalViews", label: t("admin.dashboard.totalViews"), value: stats.total_views },
    { key: "totalUsers", label: t("admin.dashboard.totalUsers"), value: stats.total_users },
    { key: "totalCategories", label: t("admin.dashboard.totalCategories"), value: stats.total_categories },
    { key: "totalTags", label: t("admin.dashboard.totalTags"), value: stats.total_tags },
    { key: "totalChapters", label: t("admin.dashboard.totalChapters"), value: stats.total_chapters },
    { key: "totalLists", label: t("admin.dashboard.totalLists"), value: stats.total_lists },
  ];

  const maxTopMangaViews = Math.max(1, ...stats.top_manga.map((m) => m.view_count));
  const maxTopCategoryViews = Math.max(1, ...stats.top_categories.map((c) => c.total_views));
  const totalUsersForRoles = stats.role_breakdown.reduce((sum, r) => sum + r.count, 0) || 1;

  return (
    <div className="page admin-dashboard-page">
      <div className="admin-dashboard-header">
        <h1>{t("admin.dashboard.title")}</h1>
        <AdminMangaSearch
          placeholder={t("admin.dashboard.searchPlaceholder")}
          onSelect={(m) => navigate(`/admin/dashboard/manga/${m.id}`)}
        />
      </div>

      <div className="dashboard-stat-grid">
        {statCards.map((card, i) => (
          <div key={card.key} style={{ animationDelay: `${i * 40}ms` }}>
            <StatCard label={card.label} value={card.value} />
          </div>
        ))}
      </div>

      <section className="dashboard-section dashboard-trend-section">
        <div className="dashboard-trend-header">
          <h2>{t("admin.dashboard.viewsOverTime")}</h2>
          <div className="dashboard-trend-controls">
            <RangeSelect unit={granularity} count={rangeCount} onChange={setRangeCount} />
            <GranularityToggle value={granularity} onChange={handleGranularityChange} />
          </div>
        </div>
        {trend ? (
          <LineChart
            series={[{ key: "views", label: t("admin.dashboard.totalViews"), color: "var(--accent)", data: trend }]}
            granularity={granularity}
          />
        ) : (
          <p className="empty-state">{t("common.loading")}</p>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-section">
          <h2>{t("admin.dashboard.topManga")}</h2>
          {stats.top_manga.length === 0 ? (
            <p className="empty-state">{t("admin.dashboard.noData")}</p>
          ) : (
            <ol className="dashboard-rank-list">
              {stats.top_manga.map((m, i) => (
                <li key={m.id} className="dashboard-animate-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <Link to={`/admin/dashboard/manga/${m.id}`} className="dashboard-rank-row">
                    {m.cover_path ? (
                      <img src={m.cover_path} alt="" />
                    ) : (
                      <div className="dashboard-rank-cover-placeholder" />
                    )}
                    <span className="dashboard-rank-info">
                      <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.title) }} />
                      <span className="dashboard-rank-meta">
                        {t(`admin.dashboard.workType.${m.work_type}`)} · {m.uploader_username}
                      </span>
                      <span className="dashboard-bar-track">
                        <span
                          className="dashboard-bar-fill"
                          style={{ "--bar-fill": `${(m.view_count / maxTopMangaViews) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className="dashboard-rank-value">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        visibility
                      </span>
                      {m.view_count.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="dashboard-section">
          <h2>{t("admin.dashboard.topCategories")}</h2>
          {stats.top_categories.length === 0 ? (
            <p className="empty-state">{t("admin.dashboard.noData")}</p>
          ) : (
            <ol className="dashboard-rank-list">
              {stats.top_categories.map((c, i) => (
                <li
                  key={c.id}
                  className="dashboard-rank-row dashboard-rank-row-static dashboard-animate-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="dashboard-rank-info">
                    <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(c.title) }} />
                    <span className="dashboard-bar-track">
                      <span
                        className="dashboard-bar-fill"
                        style={{ "--bar-fill": `${(c.total_views / maxTopCategoryViews) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="dashboard-rank-value">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      visibility
                    </span>
                    {c.total_views.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="dashboard-section">
          <h2>{t("admin.dashboard.userRoles")}</h2>
          <div className="dashboard-stacked-bar">
            {stats.role_breakdown.map((r) => (
              <span
                key={r.role}
                className="dashboard-stacked-segment"
                style={{
                  "--segment-fill": `${(r.count / totalUsersForRoles) * 100}%`,
                  background: ROLE_COLORS[r.role] || "var(--text-muted)",
                }}
                title={`${t(`role.${r.role}`)}: ${r.count}`}
              />
            ))}
          </div>
          <ul className="dashboard-legend-list">
            {stats.role_breakdown.map((r) => (
              <li key={r.role}>
                <span className="line-chart-legend-key" style={{ background: ROLE_COLORS[r.role] || "var(--text-muted)" }} />
                {t(`role.${r.role}`)} · {r.count}
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-section">
          <h2>{t("admin.dashboard.recentUploads")}</h2>
          {stats.recent_uploads.length === 0 ? (
            <p className="empty-state">{t("admin.dashboard.noData")}</p>
          ) : (
            <ul className="dashboard-activity-list">
              {stats.recent_uploads.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/admin/dashboard/manga/${m.id}`}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.title) }}
                  />
                  <span className="dashboard-activity-meta">
                    {t(`admin.dashboard.workType.${m.work_type}`)} · {m.uploader_username} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-section">
          <h2>{t("admin.dashboard.recentUsers")}</h2>
          {stats.recent_users.length === 0 ? (
            <p className="empty-state">{t("admin.dashboard.noData")}</p>
          ) : (
            <ul className="dashboard-activity-list">
              {stats.recent_users.map((u) => (
                <li key={u.id}>
                  <span>{u.display_name || u.username}</span>
                  <span className="dashboard-activity-meta">
                    {t(`role.${u.role}`)} · {new Date(u.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

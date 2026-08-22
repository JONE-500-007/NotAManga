import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useCountUp } from "../hooks/useCountUp";

// The admin area's front door. The navbar used to list every admin page
// individually, which crowded the bar (and the mobile drawer) with five
// entries a reader never sees; now it links here once and this page is what
// fans back out to the individual tools.
const SECTIONS = [
  { key: "dashboard", to: "/admin/dashboard", icon: "insights" },
  { key: "categories", to: "/admin/categories", icon: "dashboard" },
  { key: "tags", to: "/admin/tags", icon: "sell" },
  { key: "linkSites", to: "/admin/link-sites", icon: "link" },
  { key: "announcements", to: "/admin/announcements", icon: "campaign" },
];

function HubStat({ icon, value, label }) {
  const animated = useCountUp(value);
  return (
    <div className="admin-hub-stat">
      <span className="material-symbols-outlined admin-hub-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="admin-hub-stat-text">
        <span className="admin-hub-stat-value">{animated.toLocaleString()}</span>
        <span className="admin-hub-stat-label">{label}</span>
      </span>
    </div>
  );
}

export default function AdminHubPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);

  // The same endpoint the dashboard uses — the numbers up top are a preview
  // of what's in there, so there's no separate summary route to keep in sync.
  useEffect(() => {
    api.get("/admin/stats").then(setStats).catch(() => setStats(null));
  }, []);

  const statCards = stats
    ? [
        { key: "users", icon: "group", value: stats.total_users, label: t("admin.dashboard.totalUsers") },
        { key: "manga", icon: "menu_book", value: stats.total_manga, label: t("admin.dashboard.totalManga") },
        { key: "novels", icon: "auto_stories", value: stats.total_novels, label: t("admin.dashboard.totalNovels") },
        { key: "chapters", icon: "layers", value: stats.total_chapters, label: t("admin.dashboard.totalChapters") },
        { key: "views", icon: "visibility", value: stats.total_views, label: t("admin.dashboard.totalViews") },
      ]
    : [];

  return (
    <div className="page admin-hub-page">
      <header className="admin-hub-header">
        <h1>
          <span className="material-symbols-outlined" aria-hidden="true">
            shield_person
          </span>
          {t("admin.hub.title")}
        </h1>
        <p className="admin-hub-subtitle">{t("admin.hub.subtitle")}</p>
      </header>

      {stats && (
        <div className="admin-hub-stat-row">
          {statCards.map((card, i) => (
            <div key={card.key} className="dashboard-animate-in" style={{ animationDelay: `${i * 40}ms` }}>
              <HubStat icon={card.icon} value={card.value} label={card.label} />
            </div>
          ))}
        </div>
      )}

      <h2 className="admin-hub-section-heading">{t("admin.hub.whatToManage")}</h2>

      <div className="admin-hub-grid">
        {SECTIONS.map((section, i) => (
          <Link
            key={section.key}
            to={section.to}
            className="admin-hub-card dashboard-animate-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="material-symbols-outlined admin-hub-card-icon" aria-hidden="true">
              {section.icon}
            </span>
            <span className="admin-hub-card-title">{t(`admin.hub.${section.key}.title`)}</span>
            <span className="admin-hub-card-desc">{t(`admin.hub.${section.key}.desc`)}</span>
          </Link>
        ))}
      </div>

      <p className="admin-hub-back">
        <Link to="/">
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          {t("admin.hub.backToSite")}
        </Link>
      </p>
    </div>
  );
}

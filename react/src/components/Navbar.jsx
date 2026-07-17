import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        NotAManga
      </Link>

      <nav className="navbar-links">
        <Link to="/">{t("nav.browse")}</Link>
      </nav>

      <div className="navbar-actions">
        <div className="lang-toggle">
          <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
            EN
          </button>
          <span>|</span>
          <button className={lang === "th" ? "active" : ""} onClick={() => setLang("th")}>
            TH
          </button>
        </div>

        {user ? (
          <>
            <div className="navbar-actions-desktop">
              {(user.role === "uploader" || user.role === "admin") && (
                <Link to="/upload/manga" className="btn btn-accent">
                  {t("nav.uploadManga")}
                </Link>
              )}
              {(user.role === "uploader" || user.role === "admin") && (
                <Link to="/my-uploads" className="btn btn-ghost">
                  {t("nav.myUploads")}
                </Link>
              )}
              {user.role === "admin" && (
                <Link to="/admin/categories" className="btn btn-ghost">
                  {t("nav.admin")}
                </Link>
              )}
              <span className="navbar-user">
                {user.username}
                <span className="role-badge">{t(`role.${user.role}`)}</span>
              </span>
              <button className="btn btn-ghost" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            </div>

            <button
              type="button"
              className={`hamburger-btn${menuOpen ? " open" : ""}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t("nav.menu")}
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-ghost">
            {t("nav.login")}
          </Link>
        )}
      </div>

      {user && menuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}>
          <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <Link to="/" className="btn btn-ghost" onClick={closeMenu}>
              {t("nav.browse")}
            </Link>
            <div className="mobile-menu-user">
              {user.username}
              <span className="role-badge">{t(`role.${user.role}`)}</span>
            </div>
            {(user.role === "uploader" || user.role === "admin") && (
              <Link to="/upload/manga" className="btn btn-accent" onClick={closeMenu}>
                {t("nav.uploadManga")}
              </Link>
            )}
            {(user.role === "uploader" || user.role === "admin") && (
              <Link to="/my-uploads" className="btn btn-ghost" onClick={closeMenu}>
                {t("nav.myUploads")}
              </Link>
            )}
            {user.role === "admin" && (
              <Link to="/admin/categories" className="btn btn-ghost" onClick={closeMenu}>
                {t("nav.admin")}
              </Link>
            )}
            <button className="btn btn-ghost" onClick={handleLogout}>
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

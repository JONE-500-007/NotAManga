import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
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
            {user.role === "uploader" && (
              <Link to="/upload/manga" className="btn btn-accent">
                {t("nav.uploadManga")}
              </Link>
            )}
            <span className="navbar-user">
              {user.username}
              <span className="role-badge">{t(`role.${user.role}`)}</span>
            </span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-ghost">
            {t("nav.login")}
          </Link>
        )}
      </div>
    </header>
  );
}

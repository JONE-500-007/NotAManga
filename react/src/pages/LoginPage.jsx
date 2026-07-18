import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import GoogleButton from "../components/GoogleButton";

export default function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      setError(err.message || t("login.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-btn">
        <span className="material-symbols-outlined">arrow_back</span>
        {t("login.backToIndex")}
      </Link>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{t("login.title")}</h1>

        {searchParams.get("error") === "google" && <p className="form-error">{t("login.googleError")}</p>}
        {searchParams.get("reset") === "1" && <p className="auth-message">{t("login.resetSuccess")}</p>}

        <label>
          {t("login.identifier")}
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </label>

        <label>
          {t("login.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <Link to="/forgot-password" className="auth-forgot-link">
          {t("login.forgotPassword")}
        </Link>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("login.submit")}
        </button>

        <div className="auth-divider">
          <span>{t("common.or")}</span>
        </div>

        <GoogleButton>{t("login.orGoogle")}</GoogleButton>

        <p className="auth-switch">
          <Link to="/register">{t("login.registerPrompt")}</Link>
        </p>
      </form>
    </div>
  );
}

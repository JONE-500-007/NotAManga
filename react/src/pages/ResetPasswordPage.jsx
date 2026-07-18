import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("resetPassword.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/login?reset=1");
    } catch (err) {
      setError(err.message);
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

      {!token ? (
        <div className="auth-card">
          <h1>{t("resetPassword.title")}</h1>
          <p className="form-error">{t("resetPassword.invalidLink")}</p>
          <p className="auth-switch">
            <Link to="/forgot-password">{t("forgotPassword.title")}</Link>
          </p>
        </div>
      ) : (
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>{t("resetPassword.title")}</h1>

          <label>
            {t("resetPassword.password")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          <label>
            {t("resetPassword.confirmPassword")}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-accent" disabled={submitting}>
            {t("resetPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}

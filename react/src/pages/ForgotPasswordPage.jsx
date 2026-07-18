import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { identifier });
    } finally {
      // Always show the same confirmation, whether or not an account
      // matched — the backend deliberately doesn't reveal which.
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-btn">
        <span className="material-symbols-outlined">arrow_back</span>
        {t("login.backToIndex")}
      </Link>

      {sent ? (
        <div className="auth-card">
          <h1>{t("forgotPassword.title")}</h1>
          <p className="auth-message">{t("forgotPassword.sent")}</p>
          <p className="auth-switch">
            <Link to="/login">{t("forgotPassword.backToLogin")}</Link>
          </p>
        </div>
      ) : (
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>{t("forgotPassword.title")}</h1>

          <label>
            {t("forgotPassword.identifier")}
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </label>

          <button type="submit" className="btn btn-accent" disabled={submitting}>
            {t("forgotPassword.submit")}
          </button>

          <p className="auth-switch">
            <Link to="/login">{t("forgotPassword.backToLogin")}</Link>
          </p>
        </form>
      )}
    </div>
  );
}

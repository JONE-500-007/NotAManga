import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import GoogleButton from "../components/GoogleButton";
// Facebook Login is disabled — see the matching comment in LoginPage.jsx.
// import FacebookButton from "../components/FacebookButton";
import PasswordInput from "../components/PasswordInput";

export default function RegisterPage() {
  const { user, register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(username, email, password);
      navigate("/");
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
        {t("register.backToIndex")}
      </Link>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{t("register.title")}</h1>

        <label>
          {t("register.username")}
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>

        <label>
          {t("register.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          {t("register.password")}
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("register.submit")}
        </button>

        <div className="auth-divider">
          <span>{t("common.or")}</span>
        </div>

        <GoogleButton>{t("register.orGoogle")}</GoogleButton>
        {/* <FacebookButton>{t("register.orFacebook")}</FacebookButton> */}

        <p className="auth-switch">
          <Link to="/login">{t("register.loginPrompt")}</Link>
        </p>
      </form>
    </div>
  );
}

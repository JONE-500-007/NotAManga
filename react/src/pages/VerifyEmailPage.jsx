import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function VerifyEmailPage() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError(t("verifyEmail.invalidLink"));
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(async () => {
        // Always try to refresh — not just when `user` is already truthy.
        // AuthProvider's own /auth/me fetch races this effect on first
        // load, so `user` can still be null here even when this browser
        // does hold a valid session for the account just verified.
        // refreshUser() no-ops safely if there's genuinely no session.
        await refreshUser();
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-page">
      <Link to="/" className="auth-back-btn">
        <span className="material-symbols-outlined">arrow_back</span>
        {t("login.backToIndex")}
      </Link>

      <div className="auth-card">
        <h1>{t("verifyEmail.title")}</h1>

        {status === "verifying" && <p className="auth-message">{t("verifyEmail.verifying")}</p>}
        {status === "success" && <p className="auth-message">{t("verifyEmail.success")}</p>}
        {status === "error" && <p className="form-error">{error}</p>}

        <p className="auth-switch">
          <Link to={user ? "/profile" : "/login"}>
            {user ? t("verifyEmail.backToProfile") : t("forgotPassword.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}

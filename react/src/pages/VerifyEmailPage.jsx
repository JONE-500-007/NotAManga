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
        // If this browser also happens to be logged in as the account that
        // just got verified, refresh its state so the profile page's
        // "unverified" banner disappears immediately.
        if (user) await refreshUser();
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

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function UploaderRoute() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) return <div className="page-loading">{t("common.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "uploader") return <Navigate to="/" replace />;

  return <Outlet />;
}

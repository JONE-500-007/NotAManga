import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import UploaderRoute from "./components/UploaderRoute";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import BrowsePage from "./pages/BrowsePage";
import MangaDetailPage from "./pages/MangaDetailPage";
import ReaderPage from "./pages/ReaderPage";
import UploadMangaPage from "./pages/UploadMangaPage";
import UploadChapterPage from "./pages/UploadChapterPage";
import EditMangaPage from "./pages/EditMangaPage";
import EditChapterPage from "./pages/EditChapterPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

function Layout() {
  return (
    <>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/*
              Public browsing: index, manga detail, chapter reading and public
              user profiles need no account (MangaDex-style). Only account
              actions (upload/edit/admin, editing your own profile) are
              gated.

              To make the whole site invite-only again, wrap the block below
              back in <ProtectedRoute> the way it used to be:

                <Route element={<ProtectedRoute />}>
                  <Route path="/manga/:mangaId/chapter/:chapterId" element={<ReaderPage />} />
                  <Route element={<Layout />}>
                    <Route path="/" element={<BrowsePage />} />
                    <Route path="/manga/:mangaId" element={<MangaDetailPage />} />
                    <Route path="/users/:userId" element={<ProfilePage />} />
                    ...(UploaderRoute/AdminRoute/profile-self blocks unchanged)...
                  </Route>
                </Route>

              and delete the unguarded copies below.
            */}
            <Route path="/manga/:mangaId/chapter/:chapterId" element={<ReaderPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<BrowsePage />} />
              <Route path="/manga/:mangaId" element={<MangaDetailPage />} />
              <Route path="/users/:userId" element={<ProfilePage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              <Route element={<UploaderRoute />}>
                <Route path="/upload/manga" element={<UploadMangaPage />} />
                <Route path="/manga/:mangaId/upload-chapter" element={<UploadChapterPage />} />
                <Route path="/manga/:mangaId/edit" element={<EditMangaPage />} />
                <Route path="/manga/:mangaId/chapter/:chapterId/edit" element={<EditChapterPage />} />
              </Route>

              <Route element={<AdminRoute />}>
                <Route path="/admin/categories" element={<AdminCategoriesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;

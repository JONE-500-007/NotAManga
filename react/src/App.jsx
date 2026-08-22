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
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import DataDeletionPage from "./pages/DataDeletionPage";
import BrowsePage from "./pages/BrowsePage";
import MangaDetailPage from "./pages/MangaDetailPage";
import ChapterReaderRouter from "./pages/ChapterReaderRouter";
import UploadWorkTypePage from "./pages/UploadWorkTypePage";
import UploadMangaPage from "./pages/UploadMangaPage";
import UploadNovelPage from "./pages/UploadNovelPage";
import UploadChapterRouter from "./pages/UploadChapterRouter";
import EditMangaPage from "./pages/EditMangaPage";
import EditChapterRouter from "./pages/EditChapterRouter";
import AdminHubPage from "./pages/AdminHubPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import AdminTagsPage from "./pages/AdminTagsPage";
import AdminLinkSitesPage from "./pages/AdminLinkSitesPage";
import AdminAnnouncementsPage from "./pages/AdminAnnouncementsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminMangaStatsPage from "./pages/AdminMangaStatsPage";
import TagMangaPage from "./pages/TagMangaPage";
import ProfilePage from "./pages/ProfilePage";
import MyLibraryPage from "./pages/MyLibraryPage";
import LibraryListPage from "./pages/LibraryListPage";
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
                  <Route path="/manga/:mangaId/chapter/:chapterId" element={<ChapterReaderRouter />} />
                  <Route element={<Layout />}>
                    <Route path="/" element={<BrowsePage />} />
                    <Route path="/manga/:mangaId" element={<MangaDetailPage />} />
                    <Route path="/users/:userId" element={<ProfilePage />} />
                    ...(UploaderRoute/AdminRoute/profile-self blocks unchanged)...
                  </Route>
                </Route>

              and delete the unguarded copies below.
            */}
            <Route path="/manga/:mangaId/chapter/:chapterId" element={<ChapterReaderRouter />} />
            <Route element={<Layout />}>
              <Route path="/" element={<BrowsePage />} />
              <Route path="/manga/:mangaId" element={<MangaDetailPage />} />
              <Route path="/tags/:tagId" element={<TagMangaPage />} />
              <Route path="/users/:userId" element={<ProfilePage />} />
              <Route path="/library/:listId" element={<LibraryListPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/data-deletion" element={<DataDeletionPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/library" element={<MyLibraryPage />} />
              </Route>

              <Route element={<UploaderRoute />}>
                <Route path="/upload" element={<UploadWorkTypePage />} />
                <Route path="/upload/manga" element={<UploadMangaPage />} />
                <Route path="/upload/novel" element={<UploadNovelPage />} />
                <Route path="/manga/:mangaId/upload-chapter" element={<UploadChapterRouter />} />
                <Route path="/manga/:mangaId/edit" element={<EditMangaPage />} />
                <Route path="/manga/:mangaId/chapter/:chapterId/edit" element={<EditChapterRouter />} />
              </Route>

              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminHubPage />} />
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/dashboard/manga/:mangaId" element={<AdminMangaStatsPage />} />
                <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                <Route path="/admin/tags" element={<AdminTagsPage />} />
                <Route path="/admin/link-sites" element={<AdminLinkSitesPage />} />
                <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
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

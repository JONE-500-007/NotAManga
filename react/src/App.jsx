import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import UploaderRoute from "./components/UploaderRoute";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";
import BrowsePage from "./pages/BrowsePage";
import MangaDetailPage from "./pages/MangaDetailPage";
import ReaderPage from "./pages/ReaderPage";
import UploadMangaPage from "./pages/UploadMangaPage";
import UploadChapterPage from "./pages/UploadChapterPage";
import EditMangaPage from "./pages/EditMangaPage";
import EditChapterPage from "./pages/EditChapterPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import MyUploadsPage from "./pages/MyUploadsPage";
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

            <Route element={<ProtectedRoute />}>
              <Route path="/manga/:mangaId/chapter/:chapterId" element={<ReaderPage />} />

              <Route element={<Layout />}>
                <Route path="/" element={<BrowsePage />} />
                <Route path="/manga/:mangaId" element={<MangaDetailPage />} />

                <Route element={<UploaderRoute />}>
                  <Route path="/upload/manga" element={<UploadMangaPage />} />
                  <Route path="/manga/:mangaId/upload-chapter" element={<UploadChapterPage />} />
                  <Route path="/manga/:mangaId/edit" element={<EditMangaPage />} />
                  <Route path="/manga/:mangaId/chapter/:chapterId/edit" element={<EditChapterPage />} />
                  <Route path="/my-uploads" element={<MyUploadsPage />} />
                </Route>

                <Route element={<AdminRoute />}>
                  <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                </Route>
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

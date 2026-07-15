import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";

export default function EditChapterPage() {
  const { mangaId, chapterId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [manga, setManga] = useState(null);
  const [chapterNumber, setChapterNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addingPages, setAddingPages] = useState(false);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then(setManga);
    api.get(`/manga/${mangaId}/chapters/${chapterId}`).then((data) => {
      setChapterNumber(String(data.chapter_number));
      setVolume(data.volume != null ? String(data.volume) : "");
      setTitle(data.title || "");
      setPages(data.pages);
    });
  }, [mangaId, chapterId]);

  const commitPageOrder = async (orderedPageIds) => {
    await api.patch(`/manga/${mangaId}/chapters/${chapterId}/pages/reorder`, { orderedPageIds });
  };

  const { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset } = useDragReorder({
    items: pages || [],
    setItems: setPages,
    onCommit: commitPageOrder,
  });

  if (manga && manga.uploader_id !== user.id) {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga || !pages) return <div className="page-loading">{t("common.loading")}</div>;

  const handleSubmitMeta = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/manga/${mangaId}/chapters/${chapterId}`, {
        chapter_number: chapterNumber,
        volume,
        title,
      });
      navigate(`/manga/${mangaId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async () => {
    if (!window.confirm(t("detail.deleteChapterConfirm"))) return;
    await api.del(`/manga/${mangaId}/chapters/${chapterId}`);
    navigate(`/manga/${mangaId}`);
  };

  const handleDeletePage = async (pageId) => {
    if (!window.confirm(t("editChapter.deletePage") + "?")) return;
    await api.del(`/manga/${mangaId}/chapters/${chapterId}/pages/${pageId}`);
    setPages((current) => current.filter((p) => p.id !== pageId));
  };

  const handleAddPages = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setAddingPages(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("pages", file));
      const updatedPages = await api.postForm(`/manga/${mangaId}/chapters/${chapterId}/pages`, formData);
      setPages(updatedPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingPages(false);
      e.target.value = "";
    }
  };

  return (
    <div className="page">
      <form className="upload-form" onSubmit={handleSubmitMeta}>
        <h1>{t("editChapter.title")}</h1>

        <label>
          {t("uploadChapter.chapterNumber")}
          <input
            type="number"
            step="0.1"
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
            required
          />
        </label>

        <label>
          {t("uploadChapter.volume")}
          <input
            type="number"
            step="1"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </label>

        <label>
          {t("uploadChapter.chapterTitle")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("editChapter.submit")}
        </button>

        <div className="danger-zone">
          <span className="settings-label">{t("editManga.dangerZone")}</span>
          <button type="button" className="btn btn-danger" onClick={handleDeleteChapter}>
            {t("editChapter.deleteChapter")}
          </button>
        </div>
      </form>

      <div className="page-manager">
        <h2>{t("editChapter.pages")}</h2>
        <p className="reorder-hint">{t("editChapter.reorderHint")}</p>

        <div className="page-thumb-grid">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={`page-thumb${draggingId === page.id ? " page-thumb-dragging" : ""}`}
              draggable
              onDragStart={handleDragStart(page.id)}
              onDragOver={handleDragOver(page.id)}
              onDrop={handleDrop}
            >
              <span className="page-thumb-index">{index + 1}</span>
              <img src={page.image_path} alt={`Page ${index + 1}`} />
              <div className="page-thumb-controls">
                <button
                  type="button"
                  onClick={() => moveByOffset(page.id, -1)}
                  disabled={index === 0}
                  aria-label={t("common.moveUp")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveByOffset(page.id, 1)}
                  disabled={index === pages.length - 1}
                  aria-label={t("common.moveDown")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="page-thumb-delete"
                  onClick={() => handleDeletePage(page.id)}
                  aria-label={t("editChapter.deletePage")}
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>

        <label className="add-pages-input">
          {t("editChapter.addPages")}
          <input type="file" accept="image/*" multiple onChange={handleAddPages} disabled={addingPages} />
        </label>
      </div>
    </div>
  );
}

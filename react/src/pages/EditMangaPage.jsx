import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";
import SelectedFilePreview from "../components/SelectedFilePreview";

export default function EditMangaPage() {
  const { mangaId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const coverInputRef = useRef(null);

  const [manga, setManga] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("manga");
  const [cover, setCover] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  const handleRemoveCover = () => {
    setCover(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then((data) => {
      setManga(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setFormat(data.format || "manga");
    });
  }, [mangaId]);

  if (manga && manga.uploader_id !== user.id && user.role !== "admin") {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga) return <div className="page-loading">{t("common.loading")}</div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("format", format);
      if (cover) formData.append("cover", cover);
      await api.patchForm(`/manga/${mangaId}`, formData, setUploadProgress);
      navigate(`/manga/${mangaId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("detail.deleteMangaConfirm"))) return;
    await api.del(`/manga/${mangaId}`);
    navigate("/");
  };

  return (
    <div className="page">
      <form className="upload-form" onSubmit={handleSubmit}>
        <h1>{t("editManga.title")}</h1>

        <label>
          {t("uploadManga.titleLabel")}
          <MarkdownEditor
            className="manga-title-input"
            value={title}
            onChange={setTitle}
            multiline={false}
            headings={false}
            lists={false}
            required
          />
        </label>

        <label>
          {t("uploadManga.description")}
          <MarkdownEditor value={description} onChange={setDescription} />
        </label>

        <div className="settings-row">
          <span className="settings-label">{t("uploadManga.format")}</span>
          <div className="settings-toggle-group">
            <button type="button" className={format === "manga" ? "active" : ""} onClick={() => setFormat("manga")}>
              {t("uploadManga.formatManga")}
            </button>
            <button type="button" className={format === "comic" ? "active" : ""} onClick={() => setFormat("comic")}>
              {t("uploadManga.formatComic")}
            </button>
          </div>
        </div>

        {manga.cover_path && (
          <div>
            <span className="settings-label">{t("editManga.currentCover")}</span>
            <img
              src={manga.cover_path}
              alt={manga.title}
              className="edit-current-cover"
              onClick={() => setLightboxOpen(true)}
            />
          </div>
        )}

        <label>
          {t("uploadManga.cover")}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
        </label>
        <SelectedFilePreview file={cover} onRemove={handleRemoveCover} />

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("editManga.submit")}
        </button>

        <div className="danger-zone">
          <span className="settings-label">{t("editManga.dangerZone")}</span>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            {t("editManga.deleteManga")}
          </button>
        </div>
      </form>

      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button
            className="lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label={t("common.close")}
          >
            &times;
          </button>
          <img src={manga.cover_path} alt={manga.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

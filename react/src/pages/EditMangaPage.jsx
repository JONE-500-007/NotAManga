import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function EditMangaPage() {
  const { mangaId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [manga, setManga] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then((data) => {
      setManga(data);
      setTitle(data.title);
      setDescription(data.description || "");
    });
  }, [mangaId]);

  if (manga && manga.uploader_id !== user.id) {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga) return <div className="page-loading">{t("common.loading")}</div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      if (cover) formData.append("cover", cover);
      await api.patchForm(`/manga/${mangaId}`, formData);
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          {t("uploadManga.description")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>

        {manga.cover_path && (
          <div>
            <span className="settings-label">{t("editManga.currentCover")}</span>
            <img src={manga.cover_path} alt={manga.title} className="edit-current-cover" />
          </div>
        )}

        <label>
          {t("uploadManga.cover")}
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
        </label>

        {error && <p className="form-error">{error}</p>}

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
    </div>
  );
}

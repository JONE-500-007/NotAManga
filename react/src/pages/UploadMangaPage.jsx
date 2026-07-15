import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

export default function UploadMangaPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      if (cover) formData.append("cover", cover);
      const manga = await api.postForm("/manga", formData);
      navigate(`/manga/${manga.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <form className="upload-form" onSubmit={handleSubmit}>
        <h1>{t("uploadManga.title")}</h1>

        <label>
          {t("uploadManga.titleLabel")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label>
          {t("uploadManga.description")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>

        <label>
          {t("uploadManga.cover")}
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("uploadManga.submit")}
        </button>
      </form>
    </div>
  );
}

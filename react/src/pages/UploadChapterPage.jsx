import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

export default function UploadChapterPage() {
  const { mangaId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [chapterNumber, setChapterNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("chapter_number", chapterNumber);
      formData.append("volume", volume);
      formData.append("title", title);
      pages.forEach((file) => formData.append("pages", file));
      const chapter = await api.postForm(`/manga/${mangaId}/chapters`, formData);
      navigate(`/manga/${mangaId}/chapter/${chapter.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <form className="upload-form" onSubmit={handleSubmit}>
        <h1>{t("uploadChapter.title")}</h1>

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

        <label>
          {t("uploadChapter.pages")}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPages(Array.from(e.target.files))}
          />
        </label>

        {pages.length > 0 && (
          <ol className="page-file-list">
            {pages.map((file, i) => (
              <li key={i}>{file.name}</li>
            ))}
          </ol>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("uploadChapter.submit")}
        </button>
      </form>
    </div>
  );
}

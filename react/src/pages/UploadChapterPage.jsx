import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import UploadProgressBar from "../components/UploadProgressBar";
import StagedFileList from "../components/StagedFileList";

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
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleRemovePage = (index) => {
    setPages((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("chapter_number", chapterNumber);
      formData.append("volume", volume);
      formData.append("title", title);
      pages.forEach((file) => formData.append("pages", file));
      const chapter = await api.postForm(`/manga/${mangaId}/chapters`, formData, setUploadProgress);
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

        <StagedFileList files={pages} onRemove={handleRemovePage} />

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("uploadChapter.submit")}
        </button>
      </form>
    </div>
  );
}

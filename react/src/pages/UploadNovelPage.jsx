import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";
import SelectedFilePreview from "../components/SelectedFilePreview";

export default function UploadNovelPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const coverInputRef = useRef(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleRemoveCover = () => {
    setCover(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("work_type", "novel");
      if (cover) formData.append("cover", cover);
      const manga = await api.postForm("/manga", formData, setUploadProgress);
      navigate(`/manga/${manga.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <form className="upload-form manga-form" onSubmit={handleSubmit}>
        <h1>{t("uploadNovel.title")}</h1>

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

        <label>
          {t("uploadManga.cover")}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
        </label>
        <SelectedFilePreview file={cover} onRemove={handleRemoveCover} />

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("uploadNovel.submit")}
        </button>
      </form>
    </div>
  );
}

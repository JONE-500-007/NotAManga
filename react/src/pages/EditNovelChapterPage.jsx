import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";

const noopCommit = () => {};

export default function EditNovelChapterPage() {
  const { mangaId, chapterId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const imageInputRef = useRef(null);

  const [manga, setManga] = useState(null);
  const [chapterNumber, setChapterNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then(setManga);
    api.get(`/manga/${mangaId}/chapters/${chapterId}`).then((data) => {
      setChapterNumber(String(data.chapter_number));
      setVolume(data.volume != null ? String(data.volume) : "");
      setTitle(data.title || "");
      setBlocks(
        data.blocks.map((b) => ({
          id: String(b.id),
          type: b.block_type,
          content: b.content || "",
          existingPath: b.image_path,
        }))
      );
    });
  }, [mangaId, chapterId]);

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({ items: blocks || [], setItems: setBlocks, onCommit: noopCommit });

  if (manga && manga.uploader_id !== user.id && user.role !== "admin") {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga || !blocks) return <div className="page-loading">{t("common.loading")}</div>;

  const addTextBlock = () => {
    setBlocks((current) => [...current, { id: crypto.randomUUID(), type: "text", content: "" }]);
  };

  const updateBlockContent = (id, content) => {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const handleAddImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBlocks((current) => [
      ...current,
      { id: crypto.randomUUID(), type: "image", file, previewUrl: URL.createObjectURL(file) },
    ]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleRemoveBlock = (id) => {
    setBlocks((current) => {
      const block = current.find((b) => b.id === id);
      if (block?.previewUrl) URL.revokeObjectURL(block.previewUrl);
      return current.filter((b) => b.id !== id);
    });
  };

  const handleDeleteChapter = async () => {
    if (!window.confirm(t("detail.deleteChapterConfirm"))) return;
    await api.del(`/manga/${mangaId}/chapters/${chapterId}`);
    navigate(`/manga/${mangaId}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blocks.length === 0) {
      setError(t("uploadNovelChapter.empty"));
      return;
    }
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("chapter_number", chapterNumber);
      formData.append("volume", volume);
      formData.append("title", title);

      const blocksJson = blocks.map((b) => {
        if (b.type === "text") return { type: "text", content: b.content };
        if (b.existingPath && !b.file) return { type: "image", existingPath: b.existingPath };
        formData.append("images", b.file);
        return { type: "image" };
      });
      formData.append("blocks", JSON.stringify(blocksJson));

      await api.patchForm(`/manga/${mangaId}/novel-chapters/${chapterId}`, formData, setUploadProgress);
      navigate(`/manga/${mangaId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <form className="upload-form manga-form" onSubmit={handleSubmit}>
        <h1>{t("editNovelChapter.title")}</h1>

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
          <input type="number" step="1" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </label>

        <label>
          {t("uploadChapter.chapterTitle")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div className="settings-row">
          <span className="settings-label">{t("uploadNovelChapter.content")}</span>

          {blocks.length === 0 ? (
            <p className="empty-state">{t("uploadNovelChapter.empty")}</p>
          ) : (
            <>
              <p className="reorder-hint">{t("uploadNovelChapter.reorderHint")}</p>
              <div className="novel-blocks-list">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={`novel-block${draggingId === block.id ? " novel-block-dragging" : ""}`}
                    draggable={dragArmed}
                    onDragStart={handleDragStart(block.id)}
                    onDragOver={handleDragOver(block.id)}
                    onDrop={handleDrop}
                    onDragEnd={disarmDrag}
                  >
                    <div className="novel-block-header">
                      <span
                        className="drag-handle material-symbols-outlined"
                        onMouseDown={armDrag}
                        onMouseUp={disarmDrag}
                        aria-hidden="true"
                      >
                        drag_indicator
                      </span>
                      <span className="novel-block-type">
                        {block.type === "text" ? t("uploadNovelChapter.content") : t("uploadNovelChapter.imageBlock")}
                      </span>
                      <div className="novel-block-controls">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveByOffset(block.id, -1)}
                          disabled={index === 0}
                          aria-label={t("common.moveUp")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => moveByOffset(block.id, 1)}
                          disabled={index === blocks.length - 1}
                          aria-label={t("common.moveDown")}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveBlock(block.id)}
                        >
                          {t("uploadNovelChapter.removeBlock")}
                        </button>
                      </div>
                    </div>

                    {block.type === "text" ? (
                      <MarkdownEditor value={block.content} onChange={(val) => updateBlockContent(block.id, val)} />
                    ) : (
                      <img src={block.previewUrl || block.existingPath} alt="" className="novel-block-image-preview" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="novel-block-add-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTextBlock}>
              {t("uploadNovelChapter.addText")}
            </button>
            <label className="btn btn-ghost btn-sm">
              {t("uploadNovelChapter.addImage")}
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleAddImage} hidden />
            </label>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("editNovelChapter.submit")}
        </button>

        <div className="danger-zone">
          <span className="settings-label">{t("editManga.dangerZone")}</span>
          <button type="button" className="btn btn-danger" onClick={handleDeleteChapter}>
            {t("editChapter.deleteChapter")}
          </button>
        </div>
      </form>
    </div>
  );
}

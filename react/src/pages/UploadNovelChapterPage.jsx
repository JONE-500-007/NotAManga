import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";

const noopCommit = () => {};

export default function UploadNovelChapterPage() {
  const { mangaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const draftKey = `novel-chapter-draft-${mangaId}`;
  const txtInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [manga, setManga] = useState(null);
  const [chapterNumber, setChapterNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then(setManga);
  }, [mangaId]);

  // Restore an unsaved draft (text content only — File objects and their
  // blob: preview URLs can't survive a reload, so image blocks aren't
  // recoverable and are dropped rather than kept as broken placeholders).
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      setChapterNumber(draft.chapterNumber || "");
      setVolume(draft.volume || "");
      setTitle(draft.title || "");
      const restoredBlocks = (draft.blocks || [])
        .filter((b) => b.type === "text")
        .map((b) => ({ id: crypto.randomUUID(), type: "text", content: b.content || "" }));
      if (restoredBlocks.length > 0) {
        setBlocks(restoredBlocks);
        setDraftRestored(true);
      }
    } catch {
      // Corrupt draft — ignore it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) whenever the form changes, so a refresh/crash
  // while writing doesn't lose typed text. Image files themselves are never
  // persisted (see restore note above).
  useEffect(() => {
    const handle = setTimeout(() => {
      const draft = {
        chapterNumber,
        volume,
        title,
        blocks: blocks.map((b) => (b.type === "text" ? { type: "text", content: b.content } : { type: "image" })),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 500);
    return () => clearTimeout(handle);
  }, [chapterNumber, volume, title, blocks, draftKey]);

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({ items: blocks, setItems: setBlocks, onCommit: noopCommit });

  if (manga && manga.uploader_id !== user.id && user.role !== "admin") {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga) return <div className="page-loading">{t("common.loading")}</div>;

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

  const handleImportTxt = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBlocks((current) => [
        ...current,
        { id: crypto.randomUUID(), type: "text", content: String(reader.result || "") },
      ]);
    };
    reader.readAsText(file);
    if (txtInputRef.current) txtInputRef.current.value = "";
  };

  const handleRemoveBlock = (id) => {
    setBlocks((current) => {
      const block = current.find((b) => b.id === id);
      if (block?.previewUrl) URL.revokeObjectURL(block.previewUrl);
      return current.filter((b) => b.id !== id);
    });
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
        formData.append("images", b.file);
        return { type: "image" };
      });
      formData.append("blocks", JSON.stringify(blocksJson));

      const chapter = await api.postForm(`/manga/${mangaId}/novel-chapters`, formData, setUploadProgress);
      localStorage.removeItem(draftKey);
      navigate(`/manga/${mangaId}/chapter/${chapter.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <form className="upload-form manga-form" onSubmit={handleSubmit}>
        <h1>{t("uploadChapter.title")}</h1>

        {draftRestored && <p className="auth-message">{t("uploadNovelChapter.draftRestored")}</p>}

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
                      <img src={block.previewUrl} alt="" className="novel-block-image-preview" />
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
            <label className="btn btn-ghost btn-sm">
              {t("uploadNovelChapter.importTxt")}
              <input ref={txtInputRef} type="file" accept=".txt,text/plain" onChange={handleImportTxt} hidden />
            </label>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("uploadNovelChapter.submit")}
        </button>
      </form>
    </div>
  );
}

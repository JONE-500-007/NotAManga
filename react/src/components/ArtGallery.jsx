import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import UploadProgressBar from "./UploadProgressBar";
import SelectedFilePreview from "./SelectedFilePreview";

export default function ArtGallery({ mangaId, isOwner }) {
  const { t } = useLanguage();
  const imageInputRef = useRef(null);
  const [art, setArt] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [newCaption, setNewCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lightboxItem, setLightboxItem] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleRemoveNewFile = () => {
    setNewFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => {
    api.get(`/manga/${mangaId}/art`).then(setArt);
  }, [mangaId]);

  useEffect(() => {
    if (!lightboxItem) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setLightboxItem(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxItem]);

  const commitArtOrder = async (orderedArtIds) => {
    await api.patch(`/manga/${mangaId}/art/reorder`, { orderedArtIds });
  };

  const { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset } = useDragReorder({
    items: art || [],
    setItems: setArt,
    onCommit: commitArtOrder,
  });

  if (!art) return <div className="page-loading">{t("common.loading")}</div>;

  const handleDelete = async (artId) => {
    if (!window.confirm(t("art.deleteConfirm"))) return;
    await api.del(`/manga/${mangaId}/art/${artId}`);
    setArt((current) => current.filter((a) => a.id !== artId));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditCaption(item.caption || "");
  };

  const saveEdit = async (artId) => {
    const updated = await api.patch(`/manga/${mangaId}/art/${artId}`, { caption: editCaption });
    setArt((current) => current.map((a) => (a.id === artId ? updated : a)));
    setEditingId(null);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newFile) return;
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("image", newFile);
      formData.append("caption", newCaption);
      const created = await api.postForm(`/manga/${mangaId}/art`, formData, setUploadProgress);
      setArt((current) => [...current, created]);
      setNewFile(null);
      setNewCaption("");
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="art-gallery">
      {isOwner && art.length > 1 && <p className="reorder-hint">{t("art.reorderHint")}</p>}

      {art.length === 0 && !isOwner ? (
        <p className="empty-state">{t("art.empty")}</p>
      ) : (
        <div className="art-grid">
          {art.map((item, index) => (
            <div
              key={item.id}
              className={`art-tile${draggingId === item.id ? " art-tile-dragging" : ""}`}
              draggable={isOwner}
              onDragStart={isOwner ? handleDragStart(item.id) : undefined}
              onDragOver={isOwner ? handleDragOver(item.id) : undefined}
              onDrop={isOwner ? handleDrop : undefined}
            >
              <img
                src={item.image_path}
                alt={item.caption || ""}
                className="art-tile-image"
                onClick={() => setLightboxItem(item)}
              />

              {editingId === item.id ? (
                <div className="art-tile-edit">
                  <input
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder={t("art.caption")}
                  />
                  <div className="art-tile-edit-actions">
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => saveEdit(item.id)}>
                      {t("art.save")}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                item.caption && <p className="art-tile-caption">{item.caption}</p>
              )}

              {isOwner && editingId !== item.id && (
                <div className="art-tile-controls">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(item.id, -1)}
                    disabled={index === 0}
                    aria-label={t("common.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(item.id, 1)}
                    disabled={index === art.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}>
                    {t("art.editCaption")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    {t("art.deleteArt")}
                  </button>
                </div>
              )}
            </div>
          ))}

          {isOwner && (
            <form className="art-add-tile" onSubmit={handleAdd}>
              <span className="art-add-title">{t("art.addTitle")}</span>
              <label>
                {t("art.image")}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewFile(e.target.files[0])}
                  required
                />
              </label>
              <SelectedFilePreview file={newFile} onRemove={handleRemoveNewFile} />
              <label>
                {t("art.caption")}
                <textarea
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  rows={2}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              {submitting && <UploadProgressBar percent={uploadProgress} />}
              <button type="submit" className="btn btn-accent" disabled={submitting}>
                {t("art.submit")}
              </button>
            </form>
          )}
        </div>
      )}

      {lightboxItem && (
        <div className="lightbox-overlay" onClick={() => setLightboxItem(null)}>
          <button
            className="lightbox-close"
            onClick={() => setLightboxItem(null)}
            aria-label={t("common.close")}
          >
            &times;
          </button>
          <img
            src={lightboxItem.image_path}
            alt={lightboxItem.caption || ""}
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxItem.caption && <p className="lightbox-caption">{lightboxItem.caption}</p>}
        </div>
      )}
    </div>
  );
}

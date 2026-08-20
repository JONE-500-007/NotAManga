import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import MarkdownEditor from "../components/MarkdownEditor";
import MangaCard from "../components/MangaCard";

export default function LibraryListPage() {
  const { listId } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [editShowOnProfile, setEditShowOnProfile] = useState(false);
  const [error, setError] = useState("");
  const [arranging, setArranging] = useState(false);

  const setListManga = (updater) => {
    setList((current) => {
      if (!current) return current;
      const next = typeof updater === "function" ? updater(current.manga) : updater;
      return { ...current, manga: next };
    });
  };

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: list?.manga || [],
      setItems: setListManga,
      onCommit: (orderedMangaIds) => api.patch(`/lists/${listId}/manga/reorder`, { orderedMangaIds }),
    });

  useEffect(() => {
    setList(null);
    setNotFound(false);
    setArranging(false);
    api
      .get(`/lists/${listId}`)
      .then(setList)
      .catch(() => setNotFound(true));
  }, [listId]);

  if (notFound) return <div className="page-loading">{t("library.notFound")}</div>;
  if (!list) return <div className="page-loading">{t("common.loading")}</div>;

  const startEdit = () => {
    setEditTitle(list.title);
    setEditDescription(list.description || "");
    setEditPrivate(list.is_private);
    setEditShowOnProfile(list.show_on_profile);
    setError("");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    setError("");
    try {
      const updated = await api.patch(`/lists/${listId}`, {
        title: editTitle,
        description: editDescription,
        is_private: editPrivate,
        show_on_profile: editShowOnProfile,
      });
      setList((current) => ({ ...current, ...updated }));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm(t("library.deleteConfirm"))) return;
    await api.del(`/lists/${listId}`);
    navigate("/library");
  };

  const handleRemoveManga = async (mangaId) => {
    await api.del(`/lists/${listId}/manga/${mangaId}`);
    setList((current) => ({ ...current, manga: current.manga.filter((m) => m.id !== mangaId) }));
  };

  return (
    <div className="page library-detail-page">
      {editing ? (
        <div className="upload-form library-edit-form">
          <label>
            {t("library.titleLabel")}
            <MarkdownEditor
              value={editTitle}
              onChange={setEditTitle}
              multiline={false}
              headings={false}
              lists={false}
              required
            />
          </label>

          <label>
            {t("library.descriptionLabel")}
            <MarkdownEditor value={editDescription} onChange={setEditDescription} />
          </label>

          <label className="library-private-checkbox">
            <input type="checkbox" checked={editPrivate} onChange={(e) => setEditPrivate(e.target.checked)} />
            {t("library.private")}
          </label>

          {/* A private list can't be shown on a public profile, so this is
              disabled (and forced off) while Private is ticked — the server
              enforces the same rule, this just makes it visible. */}
          <label className="library-private-checkbox">
            <input
              type="checkbox"
              checked={editShowOnProfile && !editPrivate}
              disabled={editPrivate}
              onChange={(e) => setEditShowOnProfile(e.target.checked)}
            />
            {t("library.showOnProfile")}
          </label>
          <p className="library-checkbox-hint">{t("library.showOnProfileHint")}</p>

          {error && <p className="form-error">{error}</p>}

          <div className="library-edit-actions">
            <button type="button" className="btn btn-accent btn-sm" onClick={saveEdit}>
              {t("library.save")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="library-detail-header">
            <h1 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(list.title) }} />
            {list.is_private && <span className="role-badge">{t("library.privateBadge")}</span>}
          </div>

          {!list.is_owner && (
            <p className="library-detail-owner">{list.owner_display_name || list.owner_username}</p>
          )}

          {list.description && (
            <div
              className="manga-description"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(list.description) }}
            />
          )}

          {list.is_owner && (
            <div className="library-detail-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={startEdit}>
                {t("library.edit")}
              </button>
              {list.manga.length > 1 && (
                <button
                  type="button"
                  className={`btn btn-sm ${arranging ? "btn-accent" : "btn-ghost"}`}
                  onClick={() => setArranging((v) => !v)}
                >
                  {arranging ? t("library.doneArranging") : t("library.arrange")}
                </button>
              )}
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteList}>
                {t("library.deleteList")}
              </button>
            </div>
          )}
        </>
      )}

      {arranging && <p className="reorder-hint">{t("library.reorderMangaHint")}</p>}

      {list.manga.length === 0 ? (
        <p className="empty-state">{t("library.emptyList")}</p>
      ) : (
        <div className="manga-grid manga-grid--medium">
          {list.manga.map((m, index) => (
            <div
              key={m.id}
              className={`library-manga-tile${arranging ? " library-manga-tile-arranging" : ""}${
                draggingId === m.id ? " library-manga-tile-dragging" : ""
              }`}
              draggable={arranging && dragArmed}
              onDragStart={arranging ? handleDragStart(m.id) : undefined}
              onDragOver={arranging ? handleDragOver(m.id) : undefined}
              onDrop={arranging ? handleDrop : undefined}
              onDragEnd={arranging ? disarmDrag : undefined}
            >
              {arranging && (
                <span
                  className="drag-handle material-symbols-outlined"
                  onMouseDown={armDrag}
                  onMouseUp={disarmDrag}
                  aria-hidden="true"
                >
                  drag_indicator
                </span>
              )}
              <MangaCard manga={m} />
              {arranging ? (
                <div className="library-manga-tile-controls">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(m.id, -1)}
                    disabled={index === 0}
                    aria-label={t("common.moveUp")}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(m.id, 1)}
                    disabled={index === list.manga.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    &darr;
                  </button>
                </div>
              ) : (
                list.is_owner && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveManga(m.id)}>
                    {t("library.removeFromList")}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import MarkdownEditor from "../components/MarkdownEditor";
import AnnouncementBanner from "../components/AnnouncementBanner";

export default function AdminAnnouncementsPage() {
  const { t } = useLanguage();
  const [announcements, setAnnouncements] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState("");

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: announcements || [],
      setItems: setAnnouncements,
      onCommit: (orderedAnnouncementIds) => api.patch("/announcements/reorder", { orderedAnnouncementIds }),
    });

  useEffect(() => {
    api.get("/announcements").then(setAnnouncements);
  }, []);

  if (!announcements) return <div className="page-loading">{t("common.loading")}</div>;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await api.post("/announcements", { title: newTitle, body: newBody });
      setAnnouncements((current) => [...current, created]);
      setNewTitle("");
      setNewBody("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (announcement) => {
    setEditingId(announcement.id);
    setEditTitle(announcement.title);
    setEditBody(announcement.body || "");
    setEditError("");
  };

  const saveEdit = async (announcementId) => {
    if (!editTitle.trim()) return;
    setEditError("");
    try {
      const updated = await api.patch(`/announcements/${announcementId}`, { title: editTitle, body: editBody });
      setAnnouncements((current) => current.map((a) => (a.id === announcementId ? updated : a)));
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm(t("admin.announcements.deleteConfirm"))) return;
    await api.del(`/announcements/${announcementId}`);
    setAnnouncements((current) => current.filter((a) => a.id !== announcementId));
  };

  return (
    <div className="page admin-announcements-page">
      <h1>{t("admin.announcements.title")}</h1>
      <p className="category-description">{t("admin.announcements.hint")}</p>

      <form className="upload-form" onSubmit={handleCreate}>
        <h2>{t("admin.announcements.addTitle")}</h2>

        <label>
          {t("admin.announcements.titleLabel")}
          <MarkdownEditor
            value={newTitle}
            onChange={setNewTitle}
            multiline={false}
            headings={false}
            lists={false}
            required
          />
        </label>

        <label>
          {t("admin.announcements.bodyLabel")}
          <MarkdownEditor value={newBody} onChange={setNewBody} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("admin.announcements.submit")}
        </button>
      </form>

      {announcements.length > 1 && <p className="reorder-hint">{t("admin.announcements.reorderHint")}</p>}

      {announcements.length === 0 ? (
        <p className="empty-state">{t("admin.announcements.empty")}</p>
      ) : (
        <ul className="announcement-manage-list">
          {announcements.map((announcement, index) => (
            <li
              key={announcement.id}
              className={`announcement-manage-row${
                draggingId === announcement.id ? " announcement-manage-row-dragging" : ""
              }`}
              draggable={dragArmed}
              onDragStart={handleDragStart(announcement.id)}
              onDragOver={handleDragOver(announcement.id)}
              onDrop={handleDrop}
              onDragEnd={disarmDrag}
            >
              <span
                className="drag-handle material-symbols-outlined"
                onMouseDown={armDrag}
                onMouseUp={disarmDrag}
                aria-hidden="true"
              >
                drag_indicator
              </span>

              {editingId === announcement.id ? (
                <div className="announcement-manage-edit">
                  <label>
                    {t("admin.announcements.titleLabel")}
                    <MarkdownEditor
                      value={editTitle}
                      onChange={setEditTitle}
                      multiline={false}
                      headings={false}
                      lists={false}
                    />
                  </label>
                  <label>
                    {t("admin.announcements.bodyLabel")}
                    <MarkdownEditor value={editBody} onChange={setEditBody} />
                  </label>
                  {editError && <p className="form-error">{editError}</p>}
                  <div className="library-edit-actions">
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      onClick={() => saveEdit(announcement.id)}
                    >
                      {t("library.save")}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* The same component the browse page renders, so what an
                      admin arranges here is literally what readers see. */}
                  <div className="announcement-manage-preview">
                    <AnnouncementBanner announcement={announcement} />
                  </div>
                  <div className="announcement-manage-controls">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveByOffset(announcement.id, -1)}
                      disabled={index === 0}
                      aria-label={t("common.moveUp")}
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveByOffset(announcement.id, 1)}
                      disabled={index === announcements.length - 1}
                      aria-label={t("common.moveDown")}
                    >
                      &darr;
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(announcement)}
                    >
                      {t("library.edit")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

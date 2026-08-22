import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import MarkdownEditor from "../components/MarkdownEditor";

export default function MyLibraryPage() {
  const { t } = useLanguage();
  const [lists, setLists] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Reordering and the per-list profile toggle are destructive-ish controls
  // that don't belong in the normal read-only view, so they live behind an
  // explicit "arrange" mode — which also keeps each card a plain link when
  // you're just navigating.
  const [arranging, setArranging] = useState(false);

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: lists || [],
      setItems: setLists,
      onCommit: (orderedListIds) => api.patch("/lists/reorder", { orderedListIds }),
    });

  useEffect(() => {
    api.get("/lists").then(setLists);
  }, []);

  if (!lists) return <div className="page-loading">{t("common.loading")}</div>;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await api.post("/lists", {
        title: newTitle,
        description: newDescription,
        is_private: newPrivate,
      });
      setLists((current) => [created, ...current]);
      setNewTitle("");
      setNewDescription("");
      setNewPrivate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // The PATCH endpoint validates the whole list, so the unchanged fields are
  // sent back alongside the one being toggled.
  const handleToggleProfile = async (list) => {
    const updated = await api.patch(`/lists/${list.id}`, {
      title: list.title,
      description: list.description,
      is_private: list.is_private,
      show_on_profile: !list.show_on_profile,
    });
    setLists((current) => current.map((l) => (l.id === list.id ? { ...l, ...updated } : l)));
  };

  const renderCardBody = (list) => (
    <>
      <div className="library-card-header">
        <h3 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(list.title) }} />
        {list.is_private && <span className="role-badge">{t("library.privateBadge")}</span>}
        {list.show_on_profile && !list.is_private && (
          <span className="role-badge library-profile-badge">{t("library.onProfileBadge")}</span>
        )}
      </div>
      {list.description && (
        <div
          className="library-card-description"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(list.description) }}
        />
      )}
      <span className="library-card-count">
        {list.manga_count} {t("library.itemsSuffix")}
      </span>
      {list.preview.length > 0 && (
        <div className="library-card-preview">
          {list.preview.map((m) => (
            <div key={m.id} className="library-preview-item">
              {/* Deliberately not loading="lazy": these sit inside the
                  horizontally scrolling .library-card-preview, and Chrome
                  resolves lazy-loading against the nearest scroll container,
                  which leaves them permanently un-fetched here. At most six
                  small covers per list, so eager is the right trade. */}
              {m.cover_path ? (
                <img src={m.cover_path} alt="" draggable={false} />
              ) : (
                <div className="library-card-preview-placeholder" />
              )}
              <span
                className="library-preview-title"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.title) }}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="page library-page">
      <div className="library-page-header">
        <h1>{t("library.title")}</h1>
        {lists.length > 1 && (
          <button
            type="button"
            className={`btn btn-sm ${arranging ? "btn-accent" : "btn-ghost"}`}
            onClick={() => setArranging((v) => !v)}
          >
            {arranging ? t("library.doneArranging") : t("library.arrange")}
          </button>
        )}
      </div>

      <form className="upload-form" onSubmit={handleCreate}>
        <h2>{t("library.newListTitle")}</h2>

        <label>
          {t("library.titleLabel")}
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
          {t("library.descriptionLabel")}
          <MarkdownEditor value={newDescription} onChange={setNewDescription} />
        </label>

        <label className="check-control library-private-checkbox">
          <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} />
          {t("library.private")}
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("library.create")}
        </button>
      </form>

      {arranging && <p className="reorder-hint">{t("library.reorderHint")}</p>}

      {lists.length === 0 ? (
        <p className="empty-state">{t("library.empty")}</p>
      ) : (
        <div className="library-list">
          {lists.map((list, index) =>
            arranging ? (
              <div
                key={list.id}
                className={`library-card library-card-arranging${
                  draggingId === list.id ? " library-card-dragging" : ""
                }`}
                draggable={dragArmed}
                onDragStart={handleDragStart(list.id)}
                onDragOver={handleDragOver(list.id)}
                onDrop={handleDrop}
                onDragEnd={disarmDrag}
              >
                <div className="library-card-arrange-bar">
                  <span
                    className="drag-handle material-symbols-outlined"
                    onMouseDown={armDrag}
                    onMouseUp={disarmDrag}
                    aria-hidden="true"
                  >
                    drag_indicator
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(list.id, -1)}
                    disabled={index === 0}
                    aria-label={t("common.moveUp")}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveByOffset(list.id, 1)}
                    disabled={index === lists.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    &darr;
                  </button>
                  {/* A private list is never shown publicly, so the toggle is
                      disabled rather than silently ignored server-side. */}
                  <label
                    className="check-control check-control-sm library-profile-toggle"
                    title={t("library.showOnProfileHint")}
                  >
                    <input
                      type="checkbox"
                      checked={list.show_on_profile && !list.is_private}
                      disabled={list.is_private}
                      onChange={() => handleToggleProfile(list)}
                    />
                    {t("library.showOnProfile")}
                  </label>
                </div>
                {renderCardBody(list)}
              </div>
            ) : (
              <Link key={list.id} to={`/library/${list.id}`} className="library-card">
                {renderCardBody(list)}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}

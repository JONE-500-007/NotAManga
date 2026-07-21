import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import ArtGallery from "../components/ArtGallery";
import MangaRating from "../components/MangaRating";
import AddToLibraryButton from "../components/AddToLibraryButton";

export default function MangaDetailPage() {
  const { mangaId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [manga, setManga] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTab, setActiveTab] = useState("chapters");
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);

  useEffect(() => {
    setManga(null);
    setNotFound(false);
    api
      .get(`/manga/${mangaId}`)
      .then((data) => {
        setManga(data);
        setChapters(data.chapters);
        setTags(data.tags);
      })
      .catch(() => setNotFound(true));
  }, [mangaId]);

  useEffect(() => {
    if (!coverLightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setCoverLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [coverLightboxOpen]);

  const isOwner = user?.id === manga?.uploader_id || user?.role === "admin";

  const commitChapterOrder = async (orderedChapterIds) => {
    await api.patch(`/manga/${mangaId}/chapters/reorder`, { orderedChapterIds });
    // The reorder endpoint renumbers chapter_number to match array position (1-indexed);
    // mirror that locally so labels don't show stale numbers until the next fetch.
    setChapters((current) =>
      orderedChapterIds.map((id, index) => {
        const chapter = current.find((c) => c.id === id);
        return { ...chapter, chapter_number: index + 1 };
      })
    );
  };

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: chapters,
      setItems: setChapters,
      onCommit: commitChapterOrder,
    });

  if (notFound) return <div className="page-loading">{t("detail.notFound")}</div>;
  if (!manga) return <div className="page-loading">{t("common.loading")}</div>;

  const handleDeleteChapter = async (chapterId) => {
    if (!window.confirm(t("detail.deleteChapterConfirm"))) return;
    await api.del(`/manga/${mangaId}/chapters/${chapterId}`);
    setChapters((current) => current.filter((c) => c.id !== chapterId));
  };

  const displayChapters = isOwner ? chapters : [...chapters].reverse();
  const hasVolumes = chapters.some((c) => c.volume != null);

  let lastVolume;
  const chapterListItems = [];
  displayChapters.forEach((c, index) => {
    if (hasVolumes && c.volume !== lastVolume) {
      lastVolume = c.volume;
      chapterListItems.push(
        <li key={`volume-${c.volume ?? "none"}-${index}`} className="chapter-volume-header">
          {c.volume != null ? `${t("detail.volume")} ${c.volume}` : t("detail.noVolume")}
        </li>
      );
    }
    chapterListItems.push(
      <li
        key={c.id}
        className={draggingId === c.id ? "chapter-row-dragging" : ""}
        draggable={isOwner && dragArmed}
        onDragStart={isOwner ? handleDragStart(c.id) : undefined}
        onDragOver={isOwner ? handleDragOver(c.id) : undefined}
        onDrop={isOwner ? handleDrop : undefined}
        onDragEnd={isOwner ? disarmDrag : undefined}
      >
        {isOwner && (
          <span
            className="drag-handle material-symbols-outlined"
            onMouseDown={armDrag}
            onMouseUp={disarmDrag}
            aria-hidden="true"
          >
            drag_indicator
          </span>
        )}
        <Link to={`/manga/${manga.id}/chapter/${c.id}`} className="chapter-row">
          <span className="chapter-number">Ch. {c.chapter_number}</span>
          {c.title && <span className="chapter-title">{c.title}</span>}
        </Link>
        {isOwner && (
          <div className="chapter-row-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => moveByOffset(c.id, -1)}
              disabled={index === 0}
              aria-label={t("common.moveUp")}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => moveByOffset(c.id, 1)}
              disabled={index === displayChapters.length - 1}
              aria-label={t("common.moveDown")}
            >
              ↓
            </button>
            <Link to={`/manga/${manga.id}/chapter/${c.id}/edit`} className="btn btn-ghost btn-sm">
              {t("detail.editChapter")}
            </Link>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => handleDeleteChapter(c.id)}
            >
              {t("detail.deleteChapter")}
            </button>
          </div>
        )}
      </li>
    );
  });

  return (
    <div className="page manga-detail-page">
      <div className="manga-hero">
        {manga.cover_path ? (
          <button
            type="button"
            className="manga-hero-cover manga-hero-cover-button"
            onClick={() => setCoverLightboxOpen(true)}
            aria-label={t("detail.viewFullCover")}
          >
            <img src={manga.cover_path} alt={manga.title} />
            <span className="manga-hero-cover-expand">
              <span className="material-symbols-outlined">fullscreen</span>
            </span>
          </button>
        ) : (
          <div className="manga-hero-cover">
            <div className="manga-card-placeholder" />
          </div>
        )}
        <div className="manga-hero-info">
          <h1 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(manga.title) }} />
          {manga.is_private && (
            <span
              className={`role-badge manga-private-indicator${
                manga.privacy_locked_by_admin ? " manga-private-indicator-admin" : ""
              }`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                lock
              </span>
              {manga.privacy_locked_by_admin ? t("detail.privateByAdminIndicator") : t("detail.privateIndicator")}
            </span>
          )}
          <Link to={`/users/${manga.uploader_id}`} className="manga-uploader-credit">
            {t("detail.by")}
            {manga.uploader_avatar_path ? (
              <img src={manga.uploader_avatar_path} alt="" className="uploader-avatar-sm" />
            ) : (
              <span className="uploader-avatar-sm uploader-avatar-placeholder" />
            )}
            <span>{manga.uploader_display_name || manga.uploader_username}</span>
          </Link>

          <div className="manga-stats">
            <span className="manga-view-count">
              <span className="material-symbols-outlined" aria-hidden="true">
                visibility
              </span>
              {manga.view_count.toLocaleString()} {t("detail.views")}
            </span>
            <MangaRating
              key={manga.id}
              mangaId={manga.id}
              canRate={!!user}
              average={manga.rating_average}
              count={manga.rating_count}
              userRating={manga.user_rating}
            />
          </div>

          {manga.description && (
            <div
              className="manga-description"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(manga.description) }}
            />
          )}

          {tags.length > 0 && (
            <div className="manga-tags">
              {tags.map((tg) => (
                <Link
                  key={tg.id}
                  to={`/tags/${tg.id}`}
                  className={`tag-chip tag-chip-link${tg.color ? " tag-chip-link-custom" : ""}`}
                  style={tg.color ? { background: tg.color, color: "#fff" } : undefined}
                  dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(tg.name) }}
                />
              ))}
            </div>
          )}

          <div className="manga-hero-actions">
            {isOwner && (
              <Link to={`/manga/${manga.id}/upload-chapter`} className="btn btn-accent">
                {t("detail.uploadChapter")}
              </Link>
            )}
            {isOwner && (
              <Link to={`/manga/${manga.id}/edit`} className="btn btn-ghost">
                {t("detail.edit")}
              </Link>
            )}
            {user ? (
              <AddToLibraryButton mangaId={manga.id} />
            ) : (
              <span className="login-hint">{t("library.loginHint")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button
          type="button"
          className={activeTab === "chapters" ? "active" : ""}
          onClick={() => setActiveTab("chapters")}
        >
          {t("detail.tabChapters")}
        </button>
        <button
          type="button"
          className={activeTab === "art" ? "active" : ""}
          onClick={() => setActiveTab("art")}
        >
          {t("detail.tabArt")}
        </button>
      </div>

      {activeTab === "chapters" ? (
        <>
          {isOwner && chapters.length > 1 && <p className="reorder-hint">{t("detail.reorderHint")}</p>}
          {displayChapters.length === 0 ? (
            <p className="empty-state">{t("detail.noChapters")}</p>
          ) : (
            <ul className="chapter-list">{chapterListItems}</ul>
          )}
        </>
      ) : (
        <ArtGallery mangaId={manga.id} isOwner={isOwner} />
      )}

      {coverLightboxOpen && manga.cover_path && (
        <div className="lightbox-overlay" onClick={() => setCoverLightboxOpen(false)}>
          <button
            className="lightbox-close"
            onClick={() => setCoverLightboxOpen(false)}
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img src={manga.cover_path} alt={manga.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

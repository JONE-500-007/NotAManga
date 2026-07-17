import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import ArtGallery from "../components/ArtGallery";

export default function MangaDetailPage() {
  const { mangaId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeTab, setActiveTab] = useState("chapters");

  useEffect(() => {
    setManga(null);
    api.get(`/manga/${mangaId}`).then((data) => {
      setManga(data);
      setChapters(data.chapters);
    });
  }, [mangaId]);

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

  const { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset } = useDragReorder({
    items: chapters,
    setItems: setChapters,
    onCommit: commitChapterOrder,
  });

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
        draggable={isOwner}
        onDragStart={isOwner ? handleDragStart(c.id) : undefined}
        onDragOver={isOwner ? handleDragOver(c.id) : undefined}
        onDrop={isOwner ? handleDrop : undefined}
      >
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
        <div className="manga-hero-cover">
          {manga.cover_path ? (
            <img src={manga.cover_path} alt={manga.title} />
          ) : (
            <div className="manga-card-placeholder" />
          )}
        </div>
        <div className="manga-hero-info">
          <h1 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(manga.title) }} />
          {manga.description && (
            <div
              className="manga-description"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(manga.description) }}
            />
          )}
          <div className="manga-hero-actions">
            {(user?.role === "uploader" || user?.role === "admin") && (
              <Link to={`/manga/${manga.id}/upload-chapter`} className="btn btn-accent">
                {t("detail.uploadChapter")}
              </Link>
            )}
            {isOwner && (
              <Link to={`/manga/${manga.id}/edit`} className="btn btn-ghost">
                {t("detail.edit")}
              </Link>
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
    </div>
  );
}

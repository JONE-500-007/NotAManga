import { useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import MangaCard from "./MangaCard";
import MarkdownEditor from "./MarkdownEditor";
import SearchableSelect from "./SearchableSelect";

// Native <option> elements ignore CSS truncation (max-width/text-overflow),
// so an extremely long manga title has to be cut down in plain text here to
// keep the dropdown from stretching the whole page.
function truncateTitle(text, maxLength = 40) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export default function CategoryCard({ category, allManga, index, total, onMoveUp, onMoveDown, onUpdate, onDelete }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(category.title);
  const [editDescription, setEditDescription] = useState(category.description || "");
  const [manga, setManga] = useState(category.manga);
  const [selectedMangaId, setSelectedMangaId] = useState("");
  const [error, setError] = useState("");

  const commitMangaOrder = async (orderedMangaIds) => {
    await api.patch(`/categories/${category.id}/manga/reorder`, { orderedMangaIds });
  };

  const { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset } = useDragReorder({
    items: manga,
    setItems: setManga,
    onCommit: commitMangaOrder,
  });

  const startEdit = () => {
    setEditTitle(category.title);
    setEditDescription(category.description || "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    const updated = await api.patch(`/categories/${category.id}`, { title: editTitle, description: editDescription });
    onUpdate(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(t("admin.categories.deleteConfirm"))) return;
    await api.del(`/categories/${category.id}`);
    onDelete(category.id);
  };

  const handleAddManga = async () => {
    if (!selectedMangaId) return;
    setError("");
    try {
      const added = await api.post(`/categories/${category.id}/manga`, { mangaId: Number(selectedMangaId) });
      setManga((current) => [...current, added]);
      setSelectedMangaId("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveManga = async (mangaId) => {
    await api.del(`/categories/${category.id}/manga/${mangaId}`);
    setManga((current) => current.filter((m) => m.id !== mangaId));
  };

  const availableManga = allManga.filter((m) => !manga.some((cm) => cm.id === m.id));
  const availableMangaOptions = availableManga.map((m) => ({ value: m.id, label: truncateTitle(m.title) }));

  return (
    <div className="category-card">
      <div className="category-card-header">
        {editing ? (
          <MarkdownEditor
            className="category-title-input"
            value={editTitle}
            onChange={setEditTitle}
            multiline={false}
            headings={false}
            lists={false}
          />
        ) : (
          <h3 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(category.title) }} />
        )}
        <div className="category-card-controls">
          <button type="button" className="icon-btn" onClick={onMoveUp} disabled={index === 0} aria-label={t("common.moveUp")}>
            &uarr;
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={t("common.moveDown")}
          >
            &darr;
          </button>
          {editing ? (
            <>
              <button type="button" className="btn btn-accent btn-sm" onClick={saveEdit}>
                {t("admin.categories.save")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={startEdit}>
                {t("admin.categories.edit")}
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
                {t("admin.categories.delete")}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <MarkdownEditor value={editDescription} onChange={setEditDescription} />
      ) : (
        category.description && (
          <div
            className="category-description"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(category.description) }}
          />
        )
      )}

      {manga.length > 1 && <p className="reorder-hint">{t("admin.categories.mangaReorderHint")}</p>}

      {manga.length === 0 ? (
        <p className="empty-state">{t("admin.categories.emptyManga")}</p>
      ) : (
        <div className="category-manga-shelf">
          {manga.map((m, mangaIndex) => (
            <div
              key={m.id}
              className={`category-manga-tile${draggingId === m.id ? " category-manga-tile-dragging" : ""}`}
              draggable
              onDragStart={handleDragStart(m.id)}
              onDragOver={handleDragOver(m.id)}
              onDrop={handleDrop}
            >
              <MangaCard manga={m} />
              <div className="category-manga-tile-controls">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => moveByOffset(m.id, -1)}
                  disabled={mangaIndex === 0}
                  aria-label={t("common.moveUp")}
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => moveByOffset(m.id, 1)}
                  disabled={mangaIndex === manga.length - 1}
                  aria-label={t("common.moveDown")}
                >
                  &darr;
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveManga(m.id)}>
                  {t("admin.categories.removeManga")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="category-add-manga">
        <SearchableSelect
          options={availableMangaOptions}
          value={selectedMangaId}
          onChange={setSelectedMangaId}
          placeholder={t("admin.categories.selectManga")}
          searchPlaceholder={t("admin.categories.searchManga")}
          emptyLabel={t("admin.categories.noMangaFound")}
        />
        <button type="button" className="btn btn-accent btn-sm" onClick={handleAddManga} disabled={!selectedMangaId}>
          {t("admin.categories.addManga")}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

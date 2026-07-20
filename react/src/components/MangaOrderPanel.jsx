import { useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import MangaCard from "./MangaCard";
import SearchableSelect from "./SearchableSelect";

// Native <option> elements ignore CSS truncation (max-width/text-overflow),
// so an extremely long manga title has to be cut down in plain text here to
// keep the dropdown from stretching the whole page.
function truncateTitle(text, maxLength = 40) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// Manga with no pinned_position keep the normal auto sort (upload date).
// Pinning one gives it a pinned_position, which floats it to the front of
// "All Manga" in the order set here; unpinning just drops it back to auto.
export default function MangaOrderPanel({ allManga, setAllManga, cardSize, onCardSizeChange }) {
  const { t } = useLanguage();
  const [selectedMangaId, setSelectedMangaId] = useState("");
  const [error, setError] = useState("");

  const pinned = allManga.filter((m) => m.pinned_position != null);
  const unpinned = allManga.filter((m) => m.pinned_position == null);

  const setPinned = (updater) => {
    setAllManga((current) => {
      const currentPinned = current.filter((m) => m.pinned_position != null);
      const currentUnpinned = current.filter((m) => m.pinned_position == null);
      const nextPinned = typeof updater === "function" ? updater(currentPinned) : updater;
      return [...nextPinned, ...currentUnpinned];
    });
  };

  const commitOrder = async (orderedMangaIds) => {
    await api.patch("/manga/reorder", { orderedMangaIds });
  };

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({ items: pinned, setItems: setPinned, onCommit: commitOrder });

  const handlePin = async () => {
    if (!selectedMangaId) return;
    setError("");
    try {
      const pinnedManga = await api.patch(`/manga/${Number(selectedMangaId)}/pin`);
      setAllManga((current) => [...current.filter((m) => m.id !== pinnedManga.id), pinnedManga]);
      setSelectedMangaId("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnpin = async (mangaId) => {
    await api.del(`/manga/${mangaId}/pin`);
    setAllManga((current) => current.map((m) => (m.id === mangaId ? { ...m, pinned_position: null } : m)));
  };

  const unpinnedOptions = unpinned.map((m) => ({ value: m.id, label: truncateTitle(m.title) }));

  return (
    <div className="category-card">
      <div className="category-card-header">
        <h3>{t("admin.categories.allMangaOrder")}</h3>
        <div className="category-card-controls">
          <label className="category-size-select">
            {t("admin.categories.cardSize")}
            <select value={cardSize || "medium"} onChange={(e) => onCardSizeChange(e.target.value)}>
              <option value="xs">{t("admin.categories.sizeXSmall")}</option>
              <option value="small">{t("admin.categories.sizeSmall")}</option>
              <option value="medium">{t("admin.categories.sizeMedium")}</option>
              <option value="large">{t("admin.categories.sizeLarge")}</option>
              <option value="xl">{t("admin.categories.sizeXLarge")}</option>
            </select>
          </label>
        </div>
      </div>
      <p className="category-description">{t("admin.categories.allMangaOrderHint")}</p>

      {pinned.length > 1 && <p className="reorder-hint">{t("admin.categories.mangaReorderHint")}</p>}

      {pinned.length === 0 ? (
        <p className="empty-state">{t("admin.categories.noPinnedManga")}</p>
      ) : (
        <div className="category-manga-shelf">
          {pinned.map((m, mangaIndex) => (
            <div
              key={m.id}
              className={`category-manga-tile${draggingId === m.id ? " category-manga-tile-dragging" : ""}`}
              draggable={dragArmed}
              onDragStart={handleDragStart(m.id)}
              onDragOver={handleDragOver(m.id)}
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
                  disabled={mangaIndex === pinned.length - 1}
                  aria-label={t("common.moveDown")}
                >
                  &darr;
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleUnpin(m.id)}>
                  {t("admin.categories.unpinManga")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="category-add-manga">
        <SearchableSelect
          options={unpinnedOptions}
          value={selectedMangaId}
          onChange={setSelectedMangaId}
          placeholder={t("admin.categories.selectManga")}
          searchPlaceholder={t("admin.categories.searchManga")}
          emptyLabel={t("admin.categories.noMangaFound")}
        />
        <button type="button" className="btn btn-accent btn-sm" onClick={handlePin} disabled={!selectedMangaId}>
          {t("admin.categories.pinManga")}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

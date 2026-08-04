import { useLanguage } from "../context/LanguageContext";

// A drag-and-arrow-reorderable list of plain text entries — shared by
// Alternative Titles, Author(s) and Artist(s) on the edit-manga form, which
// are otherwise identical apart from labels/placeholders.
export default function StringListEditor({ label, items, handlers, drag, placeholder, addLabel }) {
  const { t } = useLanguage();

  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      {items.length > 1 && <p className="reorder-hint">{t("editManga.linksReorderHint")}</p>}
      {items.length > 0 && (
        <div className="alt-titles-list">
          {items.map((item, index) => (
            <div
              className={`alt-title-row${drag.draggingId === item.id ? " alt-title-row-dragging" : ""}`}
              key={item.id}
              draggable={drag.dragArmed}
              onDragStart={drag.handleDragStart(item.id)}
              onDragOver={drag.handleDragOver(item.id)}
              onDrop={drag.handleDrop}
              onDragEnd={drag.disarmDrag}
            >
              <span
                className="drag-handle material-symbols-outlined"
                onMouseDown={drag.armDrag}
                onMouseUp={drag.disarmDrag}
                aria-hidden="true"
              >
                drag_indicator
              </span>
              <input
                value={item.value}
                placeholder={placeholder}
                onChange={(e) => handlers.update(index, e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => handlers.move(index, -1)}
                disabled={index === 0}
                aria-label={t("common.moveUp")}
              >
                &uarr;
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => handlers.move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={t("common.moveDown")}
              >
                &darr;
              </button>
              <button
                type="button"
                className="tag-chip-remove"
                onClick={() => handlers.remove(index)}
                aria-label={t("common.remove")}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={handlers.add}>
        {addLabel}
      </button>
    </div>
  );
}

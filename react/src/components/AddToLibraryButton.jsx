import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown } from "../utils/renderMarkdown";

export default function AddToLibraryButton({ mangaId }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && lists === null) {
      setLoading(true);
      try {
        setLists(await api.get(`/manga/${mangaId}/lists`));
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleMembership = async (list) => {
    setError("");
    try {
      if (list.has_manga) {
        await api.del(`/lists/${list.id}/manga/${mangaId}`);
      } else {
        await api.post(`/lists/${list.id}/manga`, { mangaId: Number(mangaId) });
      }
      setLists((current) => current.map((l) => (l.id === list.id ? { ...l, has_manga: !l.has_manga } : l)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError("");
    try {
      const created = await api.post("/lists", { title: newTitle, description: "", is_private: false });
      await api.post(`/lists/${created.id}/manga`, { mangaId: Number(mangaId) });
      setLists((current) => [{ id: created.id, title: created.title, has_manga: true }, ...(current || [])]);
      setNewTitle("");
      setCreating(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="manga-library-menu" ref={menuRef}>
      <button type="button" className="btn btn-ghost" onClick={toggleOpen} aria-expanded={open}>
        <span className="material-symbols-outlined" aria-hidden="true">
          bookmark_add
        </span>
        {t("library.addToLibrary")}
      </button>
      {open && (
        <div className="admin-menu-panel manga-library-panel">
          {loading ? (
            <p className="manga-library-status">{t("common.loading")}</p>
          ) : lists && lists.length > 0 ? (
            lists.map((list) => (
              <label key={list.id} className="check-control check-control-sm manga-library-item">
                <input type="checkbox" checked={list.has_manga} onChange={() => toggleMembership(list)} />
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(list.title) }} />
              </label>
            ))
          ) : (
            <p className="manga-library-status">{t("library.noLists")}</p>
          )}

          {creating ? (
            <form className="manga-library-create-form" onSubmit={handleCreateAndAdd}>
              <input
                type="text"
                className="manga-library-create-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("library.titleLabel")}
                autoFocus
              />
              <button type="submit" className="btn btn-accent btn-sm" disabled={!newTitle.trim()}>
                {t("library.create")}
              </button>
            </form>
          ) : (
            <button type="button" className="admin-menu-item manga-library-new" onClick={() => setCreating(true)}>
              {t("library.addNew")}
            </button>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

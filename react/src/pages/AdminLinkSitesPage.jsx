import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import SelectedFilePreview from "../components/SelectedFilePreview";

const CATEGORIES = ["read_or_buy", "track"];

function LinkSiteCategorySection({ category, sites, setSites, t }) {
  const categorySites = sites.filter((s) => s.category === category);

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState(null);
  const [editError, setEditError] = useState("");
  const newIconRef = useRef(null);
  const editIconRef = useRef(null);

  // Reorder hooks work on a plain array + setter; this wraps the shared
  // `sites` state so the hook only ever sees (and only ever writes back)
  // this category's slice of it.
  const setCategoryItems = (updater) => {
    setSites((current) => {
      const currentCategoryItems = current.filter((s) => s.category === category);
      const others = current.filter((s) => s.category !== category);
      const updated = typeof updater === "function" ? updater(currentCategoryItems) : updater;
      return [...others, ...updated];
    });
  };

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: categorySites,
      setItems: setCategoryItems,
      onCommit: (orderedSiteIds) => api.patch("/link-sites/reorder", { category, orderedSiteIds }),
    });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", newName);
      formData.append("category", category);
      if (newIcon) formData.append("icon", newIcon);
      const created = await api.postForm("/link-sites", formData);
      setSites((current) => [...current, created]);
      setNewName("");
      setNewIcon(null);
      if (newIconRef.current) newIconRef.current.value = "";
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (site) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditIcon(null);
    setEditError("");
  };

  const saveEdit = async (siteId) => {
    if (!editName.trim()) return;
    setEditError("");
    try {
      const formData = new FormData();
      formData.append("name", editName);
      if (editIcon) formData.append("icon", editIcon);
      const updated = await api.patchForm(`/link-sites/${siteId}`, formData);
      setSites((current) => current.map((s) => (s.id === siteId ? updated : s)));
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleDelete = async (siteId) => {
    if (!window.confirm(t("admin.linkSites.deleteConfirm"))) return;
    await api.del(`/link-sites/${siteId}`);
    setSites((current) => current.filter((s) => s.id !== siteId));
  };

  const trimmedSearch = search.trim().toLowerCase();
  const visibleSites = trimmedSearch
    ? categorySites.filter((s) => s.name.toLowerCase().includes(trimmedSearch))
    : categorySites;

  return (
    <div className="admin-link-sites-section">
      <h2>{t(`admin.linkSites.${category}`)}</h2>

      <form className="upload-form" onSubmit={handleAdd}>
        <label>
          {t("admin.linkSites.nameLabel")}
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label>
          {t("admin.linkSites.iconLabel")}
          <input
            ref={newIconRef}
            type="file"
            accept="image/*"
            onChange={(e) => setNewIcon(e.target.files[0])}
          />
        </label>
        <SelectedFilePreview
          file={newIcon}
          onRemove={() => {
            setNewIcon(null);
            if (newIconRef.current) newIconRef.current.value = "";
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("admin.linkSites.submit")}
        </button>
      </form>

      <input
        type="search"
        className="browse-search-input tag-search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin.linkSites.searchPlaceholder")}
      />

      {categorySites.length > 1 && !trimmedSearch && <p className="reorder-hint">{t("admin.linkSites.reorderHint")}</p>}

      {categorySites.length === 0 ? (
        <p className="empty-state">{t("admin.linkSites.empty")}</p>
      ) : visibleSites.length === 0 ? (
        <p className="empty-state">{t("admin.linkSites.searchEmpty")}</p>
      ) : (
        <ul className="tag-manage-list">
          {visibleSites.map((site, index) => (
            <li
              key={site.id}
              className={`tag-manage-row${draggingId === site.id ? " tag-manage-row-dragging" : ""}`}
              draggable={!trimmedSearch && dragArmed}
              onDragStart={trimmedSearch ? undefined : handleDragStart(site.id)}
              onDragOver={trimmedSearch ? undefined : handleDragOver(site.id)}
              onDrop={trimmedSearch ? undefined : handleDrop}
              onDragEnd={trimmedSearch ? undefined : disarmDrag}
            >
              {!trimmedSearch && (
                <span
                  className="drag-handle material-symbols-outlined"
                  onMouseDown={armDrag}
                  onMouseUp={disarmDrag}
                  aria-hidden="true"
                >
                  drag_indicator
                </span>
              )}

              {editingId === site.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input
                    ref={editIconRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditIcon(e.target.files[0])}
                  />
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => saveEdit(site.id)}>
                    {t("admin.linkSites.save")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                    {t("common.cancel")}
                  </button>
                  {editError && <p className="form-error">{editError}</p>}
                </>
              ) : (
                <>
                  {site.icon_path ? (
                    <img src={site.icon_path} alt="" className="link-site-icon-preview" />
                  ) : (
                    <span className="material-symbols-outlined link-site-icon-preview" aria-hidden="true">
                      link
                    </span>
                  )}
                  <span className="link-site-name">{site.name}</span>
                  {!trimmedSearch && (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => moveByOffset(site.id, -1)}
                        disabled={index === 0}
                        aria-label={t("common.moveUp")}
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => moveByOffset(site.id, 1)}
                        disabled={index === visibleSites.length - 1}
                        aria-label={t("common.moveDown")}
                      >
                        &darr;
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(site)}>
                    {t("admin.linkSites.rename")}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(site.id)}>
                    {t("admin.linkSites.delete")}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminLinkSitesPage() {
  const { t } = useLanguage();
  const [sites, setSites] = useState(null);

  useEffect(() => {
    api.get("/link-sites").then(setSites);
  }, []);

  if (!sites) return <div className="page-loading">{t("common.loading")}</div>;

  return (
    <div className="page admin-tags-page">
      <h1>{t("admin.linkSites.title")}</h1>
      {CATEGORIES.map((category) => (
        <LinkSiteCategorySection key={category} category={category} sites={sites} setSites={setSites} t={t} />
      ))}
    </div>
  );
}

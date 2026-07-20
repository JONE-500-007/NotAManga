import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown } from "../utils/renderMarkdown";
import MarkdownEditor from "../components/MarkdownEditor";

const DEFAULT_COLOR = "#ff6740";

export default function AdminTagsPage() {
  const { t } = useLanguage();
  const [tags, setTags] = useState(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    api.get("/tags").then(setTags);
  }, []);

  if (!tags) return <div className="page-loading">{t("common.loading")}</div>;

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await api.post("/tags", { name: newName, color: newColor || null });
      setTags((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewColor("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || "");
    setEditError("");
  };

  const saveEdit = async (tagId) => {
    if (!editName.trim()) return;
    setEditError("");
    try {
      const updated = await api.patch(`/tags/${tagId}`, { name: editName, color: editColor || null });
      setTags((current) =>
        current.map((tg) => (tg.id === tagId ? updated : tg)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!window.confirm(t("admin.tags.deleteConfirm"))) return;
    await api.del(`/tags/${tagId}`);
    setTags((current) => current.filter((tg) => tg.id !== tagId));
  };

  const trimmedSearch = search.trim().toLowerCase();
  const visibleTags = trimmedSearch
    ? tags.filter((tg) => tg.name.toLowerCase().includes(trimmedSearch))
    : tags;

  return (
    <div className="page admin-tags-page">
      <h1>{t("admin.tags.title")}</h1>

      <form className="upload-form" onSubmit={handleAddTag}>
        <h2>{t("admin.tags.addTitle")}</h2>

        <label>
          {t("admin.tags.nameLabel")}
          <MarkdownEditor
            className="tag-name-input"
            value={newName}
            onChange={setNewName}
            multiline={false}
            headings={false}
            lists={false}
            required
          />
        </label>

        <label className="tag-color-row">
          {t("admin.tags.chipColor")}
          <span className="tag-color-picker">
            <input type="color" value={newColor || DEFAULT_COLOR} onChange={(e) => setNewColor(e.target.value)} />
            {newColor && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewColor("")}>
                {t("admin.tags.resetColor")}
              </button>
            )}
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("admin.tags.submit")}
        </button>
      </form>

      <input
        type="search"
        className="browse-search-input tag-search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin.tags.searchPlaceholder")}
      />

      {tags.length === 0 ? (
        <p className="empty-state">{t("admin.tags.empty")}</p>
      ) : visibleTags.length === 0 ? (
        <p className="empty-state">{t("admin.tags.searchEmpty")}</p>
      ) : (
        <ul className="tag-manage-list">
          {visibleTags.map((tag) => (
            <li key={tag.id} className="tag-manage-row">
              {editingId === tag.id ? (
                <>
                  <MarkdownEditor
                    className="tag-manage-edit-input"
                    value={editName}
                    onChange={setEditName}
                    multiline={false}
                    headings={false}
                    lists={false}
                  />
                  <span className="tag-color-picker">
                    <input
                      type="color"
                      value={editColor || DEFAULT_COLOR}
                      onChange={(e) => setEditColor(e.target.value)}
                    />
                    {editColor && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditColor("")}>
                        {t("admin.tags.resetColor")}
                      </button>
                    )}
                  </span>
                  <button type="button" className="btn btn-accent btn-sm" onClick={() => saveEdit(tag.id)}>
                    {t("admin.tags.save")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                    {t("common.cancel")}
                  </button>
                  {editError && <p className="form-error">{editError}</p>}
                </>
              ) : (
                <>
                  <span
                    className="tag-chip"
                    style={tag.color ? { background: tag.color, color: "#fff" } : undefined}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(tag.name) }}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(tag)}>
                    {t("admin.tags.rename")}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTag(tag.id)}>
                    {t("admin.tags.delete")}
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

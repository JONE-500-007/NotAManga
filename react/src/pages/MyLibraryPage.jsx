import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
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

  return (
    <div className="page library-page">
      <h1>{t("library.title")}</h1>

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

        <label className="library-private-checkbox">
          <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} />
          {t("library.private")}
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("library.create")}
        </button>
      </form>

      {lists.length === 0 ? (
        <p className="empty-state">{t("library.empty")}</p>
      ) : (
        <div className="library-list">
          {lists.map((list) => (
            <Link key={list.id} to={`/library/${list.id}`} className="library-card">
              <div className="library-card-header">
                <h3 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(list.title) }} />
                {list.is_private && <span className="role-badge">{t("library.privateBadge")}</span>}
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
                  {list.preview.map((m) =>
                    m.cover_path ? (
                      <img key={m.id} src={m.cover_path} alt="" />
                    ) : (
                      <div key={m.id} className="library-card-preview-placeholder" />
                    )
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

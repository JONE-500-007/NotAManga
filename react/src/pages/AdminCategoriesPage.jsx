import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import CategoryCard from "../components/CategoryCard";
import MarkdownEditor from "../components/MarkdownEditor";

export default function AdminCategoriesPage() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState(null);
  const [allManga, setAllManga] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/categories").then(setCategories);
    api.get("/manga").then(setAllManga);
  }, []);

  const commitCategoryOrder = async (orderedCategoryIds) => {
    await api.patch("/categories/reorder", { orderedCategoryIds });
  };

  const { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset } = useDragReorder({
    items: categories || [],
    setItems: setCategories,
    onCommit: commitCategoryOrder,
  });

  if (!categories) return <div className="page-loading">{t("common.loading")}</div>;

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const created = await api.post("/categories", { title: newTitle, description: newDescription });
      setCategories((current) => [...current, created]);
      setNewTitle("");
      setNewDescription("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCategory = (updated) => {
    setCategories((current) => current.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  const handleDeleteCategory = (categoryId) => {
    setCategories((current) => current.filter((c) => c.id !== categoryId));
  };

  return (
    <div className="page admin-categories-page">
      <h1>{t("admin.categories.title")}</h1>

      <form className="upload-form" onSubmit={handleAddCategory}>
        <h2>{t("admin.categories.addTitle")}</h2>

        <label>
          {t("admin.categories.titleLabel")}
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
          {t("admin.categories.descriptionLabel")}
          <MarkdownEditor value={newDescription} onChange={setNewDescription} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("admin.categories.submit")}
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="empty-state">{t("admin.categories.empty")}</p>
      ) : (
        <>
          {categories.length > 1 && <p className="reorder-hint">{t("admin.categories.reorderHint")}</p>}
          <div className="category-list">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className={`category-list-item${draggingId === category.id ? " category-list-item-dragging" : ""}`}
                draggable
                onDragStart={handleDragStart(category.id)}
                onDragOver={handleDragOver(category.id)}
                onDrop={handleDrop}
              >
                <CategoryCard
                  category={category}
                  allManga={allManga}
                  index={index}
                  total={categories.length}
                  onMoveUp={() => moveByOffset(category.id, -1)}
                  onMoveDown={() => moveByOffset(category.id, 1)}
                  onUpdate={handleUpdateCategory}
                  onDelete={handleDeleteCategory}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

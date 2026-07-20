import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";
import SelectedFilePreview from "../components/SelectedFilePreview";
import SearchableSelect from "../components/SearchableSelect";
import { renderInlineMarkdown, markdownToPlainText } from "../utils/renderMarkdown";

// Native <option>-style dropdown rows render plain text, so an extremely
// long tag name has to be cut down in plain text here to keep the dropdown
// from stretching the whole page.
function truncateTitle(text, maxLength = 40) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export default function EditMangaPage() {
  const { mangaId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const coverInputRef = useRef(null);

  const [manga, setManga] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState("manga");
  const [cover, setCover] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [tagError, setTagError] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [visibleRoles, setVisibleRoles] = useState([]);
  const [privacyLocked, setPrivacyLocked] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  const handleRemoveCover = () => {
    setCover(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then((data) => {
      setManga(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setFormat(data.format || "manga");
      setTags(data.tags);
      setIsPrivate(data.is_private);
      setVisibleRoles(data.visible_roles || []);
      setPrivacyLocked(data.privacy_locked_by_admin);
    });
  }, [mangaId]);

  useEffect(() => {
    api.get("/tags").then(setAllTags);
  }, []);

  if (manga && manga.uploader_id !== user.id && user.role !== "admin") {
    return <Navigate to={`/manga/${mangaId}`} replace />;
  }

  if (!manga) return <div className="page-loading">{t("common.loading")}</div>;

  const handleAddTag = async () => {
    if (!selectedTagId) return;
    setTagError("");
    try {
      const added = await api.post(`/manga/${mangaId}/tags`, { tagId: Number(selectedTagId) });
      setTags((current) => [...current, added].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTagId("");
    } catch (err) {
      setTagError(err.message);
    }
  };

  const handleRemoveTag = async (tagId) => {
    await api.del(`/manga/${mangaId}/tags/${tagId}`);
    setTags((current) => current.filter((tg) => tg.id !== tagId));
  };

  const availableTags = allTags
    .filter((tg) => !tags.some((t2) => t2.id === tg.id))
    .map((tg) => ({ value: tg.id, label: truncateTitle(markdownToPlainText(tg.name)) }));

  const visibilityLocked = privacyLocked && user.role !== "admin";

  const toggleVisibleRole = (role) => {
    setVisibleRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));
  };

  const handleSaveVisibility = async () => {
    setVisibilityError("");
    setVisibilitySaving(true);
    try {
      const updated = await api.patch(`/manga/${mangaId}/visibility`, {
        is_private: isPrivate,
        visible_roles: visibleRoles,
      });
      setVisibleRoles(updated.visible_roles || []);
    } catch (err) {
      setVisibilityError(err.message);
    } finally {
      setVisibilitySaving(false);
    }
  };

  const handleAdminLockToggle = async () => {
    const updated = await api.patch(`/manga/${mangaId}/admin-lock`, { locked: !privacyLocked });
    setPrivacyLocked(updated.privacy_locked_by_admin);
    setIsPrivate(updated.is_private);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("format", format);
      if (cover) formData.append("cover", cover);
      await api.patchForm(`/manga/${mangaId}`, formData, setUploadProgress);
      navigate(`/manga/${mangaId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("detail.deleteMangaConfirm"))) return;
    await api.del(`/manga/${mangaId}`);
    navigate("/");
  };

  return (
    <div className="page">
      <form className="upload-form manga-form" onSubmit={handleSubmit}>
        <h1>{manga.work_type === "novel" ? t("editManga.titleNovel") : t("editManga.title")}</h1>

        <label>
          {t("uploadManga.titleLabel")}
          <MarkdownEditor
            className="manga-title-input"
            value={title}
            onChange={setTitle}
            multiline={false}
            headings={false}
            lists={false}
            required
          />
        </label>

        <label>
          {t("uploadManga.description")}
          <MarkdownEditor value={description} onChange={setDescription} />
        </label>

        {manga.work_type !== "novel" && (
          <div className="settings-row">
            <span className="settings-label">{t("uploadManga.format")}</span>
            <div className="settings-toggle-group">
              <button
                type="button"
                className={format === "manga" ? "active" : ""}
                onClick={() => setFormat("manga")}
              >
                {t("uploadManga.formatManga")}
              </button>
              <button
                type="button"
                className={format === "comic" ? "active" : ""}
                onClick={() => setFormat("comic")}
              >
                {t("uploadManga.formatComic")}
              </button>
            </div>
          </div>
        )}

        <div className="settings-row">
          <span className="settings-label">{t("editManga.visibility")}</span>
          {privacyLocked && (
            <p className="form-error">
              {visibilityLocked ? t("editManga.privacyLockedHint") : t("editManga.privacyLockedAdminHint")}
            </p>
          )}
          <div className="settings-toggle-group">
            <button
              type="button"
              className={!isPrivate ? "active" : ""}
              onClick={() => setIsPrivate(false)}
              disabled={visibilityLocked}
            >
              {t("editManga.public")}
            </button>
            <button
              type="button"
              className={isPrivate ? "active" : ""}
              onClick={() => setIsPrivate(true)}
              disabled={visibilityLocked}
            >
              {t("editManga.private")}
            </button>
          </div>

          {isPrivate && (
            <div className="visibility-roles">
              <span className="visibility-roles-hint">{t("editManga.visibleRolesHint")}</span>
              <label className={`visibility-role-checkbox${visibilityLocked ? " visibility-role-checkbox-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibleRoles.includes("member")}
                  onChange={() => toggleVisibleRole("member")}
                  disabled={visibilityLocked}
                />
                {t("role.member")}
              </label>
              <label className={`visibility-role-checkbox${visibilityLocked ? " visibility-role-checkbox-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibleRoles.includes("vvip")}
                  onChange={() => toggleVisibleRole("vvip")}
                  disabled={visibilityLocked}
                />
                {t("role.vvip")}
              </label>
            </div>
          )}

          <div className="visibility-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleSaveVisibility}
              disabled={visibilitySaving || visibilityLocked}
            >
              {t("editManga.saveVisibility")}
            </button>
            {user.role === "admin" && (
              <button
                type="button"
                className={`btn btn-sm ${privacyLocked ? "btn-accent" : "btn-danger"}`}
                onClick={handleAdminLockToggle}
              >
                {privacyLocked ? t("editManga.unlockPrivacy") : t("editManga.lockPrivacyByAdmin")}
              </button>
            )}
          </div>
          {visibilityError && <p className="form-error">{visibilityError}</p>}
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("editManga.tags")}</span>
          {tags.length > 0 && (
            <div className="manga-tags">
              {tags.map((tg) => (
                <span key={tg.id} className="tag-chip-wrap">
                  <span
                    className="tag-chip"
                    style={tg.color ? { background: tg.color, color: "#fff" } : undefined}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(tg.name) }}
                  />
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => handleRemoveTag(tg.id)}
                    aria-label={t("detail.removeTag")}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="manga-tags-add">
            <SearchableSelect
              options={availableTags}
              value={selectedTagId}
              onChange={setSelectedTagId}
              placeholder={t("detail.selectTag")}
              searchPlaceholder={t("detail.searchTag")}
              emptyLabel={t("detail.noTagsFound")}
            />
            <button type="button" className="btn btn-accent btn-sm" onClick={handleAddTag} disabled={!selectedTagId}>
              {t("detail.addTag")}
            </button>
          </div>
          {tagError && <p className="form-error">{tagError}</p>}
        </div>

        {manga.cover_path && (
          <div>
            <span className="settings-label">{t("editManga.currentCover")}</span>
            <img
              src={manga.cover_path}
              alt={manga.title}
              className="edit-current-cover"
              onClick={() => setLightboxOpen(true)}
            />
          </div>
        )}

        <label>
          {t("uploadManga.cover")}
          <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
        </label>
        <SelectedFilePreview file={cover} onRemove={handleRemoveCover} />

        {error && <p className="form-error">{error}</p>}
        {submitting && <UploadProgressBar percent={uploadProgress} />}

        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {t("editManga.submit")}
        </button>

        <div className="danger-zone">
          <span className="settings-label">{t("editManga.dangerZone")}</span>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            {manga.work_type === "novel" ? t("editManga.deleteNovel") : t("editManga.deleteManga")}
          </button>
        </div>
      </form>

      {lightboxOpen && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button
            className="lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label={t("common.close")}
          >
            &times;
          </button>
          <img src={manga.cover_path} alt={manga.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

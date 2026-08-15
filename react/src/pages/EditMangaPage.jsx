import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDragReorder } from "../hooks/useDragReorder";
import UploadProgressBar from "../components/UploadProgressBar";
import MarkdownEditor from "../components/MarkdownEditor";
import SelectedFilePreview from "../components/SelectedFilePreview";
import SearchableSelect from "../components/SearchableSelect";
import StringListEditor from "../components/StringListEditor";
import { renderInlineMarkdown, markdownToPlainText } from "../utils/renderMarkdown";

const STATUS_OPTIONS = ["ongoing", "completed", "hiatus", "cancelled"];

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
  const [linkSites, setLinkSites] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [tagError, setTagError] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [visibleRoles, setVisibleRoles] = useState([]);
  const [privacyLocked, setPrivacyLocked] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const [status, setStatus] = useState("ongoing");
  const [authors, setAuthors] = useState([]);
  const [artists, setArtists] = useState([]);
  const [alternativeTitles, setAlternativeTitles] = useState([]);
  const [readOrBuyLinks, setReadOrBuyLinks] = useState([]);
  const [trackLinks, setTrackLinks] = useState([]);

  const {
    draggingId: draggingTagId,
    dragArmed: tagDragArmed,
    armDrag: armTagDrag,
    disarmDrag: disarmTagDrag,
    handleDragStart: handleTagDragStart,
    handleDragOver: handleTagDragOver,
    handleDrop: handleTagDrop,
    moveByOffset: moveTagByOffset,
  } = useDragReorder({
    items: tags,
    setItems: setTags,
    onCommit: (orderedTagIds) => api.patch(`/manga/${mangaId}/tags/reorder`, { orderedTagIds }),
  });

  // Drag reorder for all of these only touches local draft state (no
  // per-drop API call like the tags list above has) — the new order is
  // just whatever gets submitted with the rest of the form, so onCommit is
  // a no-op. Declared here (before the early returns below) since hooks
  // can't be called conditionally.
  const readOrBuyDrag = useDragReorder({
    items: readOrBuyLinks,
    setItems: setReadOrBuyLinks,
    onCommit: () => {},
  });
  const trackDrag = useDragReorder({
    items: trackLinks,
    setItems: setTrackLinks,
    onCommit: () => {},
  });
  const altTitlesDrag = useDragReorder({
    items: alternativeTitles,
    setItems: setAlternativeTitles,
    onCommit: () => {},
  });
  const authorsDrag = useDragReorder({
    items: authors,
    setItems: setAuthors,
    onCommit: () => {},
  });
  const artistsDrag = useDragReorder({
    items: artists,
    setItems: setArtists,
    onCommit: () => {},
  });

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
      setStatus(data.status || "ongoing");
      // `id` on each entry is a client-only key so drag-reorder
      // (useDragReorder) can track rows; harmless if it rides along in the
      // submit payload since the backend only reads the trimmed string.
      const toListItems = (values) => (values || []).map((value) => ({ id: crypto.randomUUID(), value }));
      setAuthors(toListItems(data.authors));
      setArtists(toListItems(data.artists));
      setAlternativeTitles(toListItems(data.alternative_titles));
      // Only site_id/url are edited here — site_name/site_icon_path are
      // display-only fields the detail page uses, resolved fresh from
      // linkSites on every render instead of being carried in this state.
      // `id` is a client-only key so drag-reorder (useDragReorder) can track
      // rows; it's harmless if it rides along in the submit payload since
      // the backend only reads category/site_id/url off each link.
      const links = (data.links || []).map((l) => ({
        id: crypto.randomUUID(),
        site_id: l.site_id,
        url: l.url,
        category: l.category,
      }));
      setReadOrBuyLinks(links.filter((l) => l.category === "read_or_buy"));
      setTrackLinks(links.filter((l) => l.category === "track"));
    });
  }, [mangaId]);

  useEffect(() => {
    api.get("/tags").then(setAllTags);
    api.get("/link-sites").then(setLinkSites);
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
      setTags((current) => [...current, added]);
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

  // Shared by Alternative Titles, Author(s) and Artist(s) — each is just an
  // ordered list of plain strings, edited/reordered the same way.
  function makeStringListHandlers(setList) {
    return {
      add: () => setList((current) => [...current, { id: crypto.randomUUID(), value: "" }]),
      update: (index, value) =>
        setList((current) => current.map((item, i) => (i === index ? { ...item, value } : item))),
      remove: (index) => setList((current) => current.filter((_, i) => i !== index)),
      move: (index, offset) =>
        setList((current) => {
          const newIndex = index + offset;
          if (newIndex < 0 || newIndex >= current.length) return current;
          const updated = [...current];
          const [item] = updated.splice(index, 1);
          updated.splice(newIndex, 0, item);
          return updated;
        }),
    };
  }
  const altTitleHandlers = makeStringListHandlers(setAlternativeTitles);
  const authorHandlers = makeStringListHandlers(setAuthors);
  const artistHandlers = makeStringListHandlers(setArtists);

  // Shared by the Read-or-Buy and Track sections — each keeps its own list
  // in state, only tagged with its category when the form actually submits.
  function makeLinkListHandlers(setLinks, category) {
    const firstSiteId = linkSites.find((s) => s.category === category)?.id ?? "";
    return {
      add: () => setLinks((current) => [...current, { id: crypto.randomUUID(), site_id: firstSiteId, url: "" }]),
      update: (index, field, value) =>
        setLinks((current) => current.map((l, i) => (i === index ? { ...l, [field]: value } : l))),
      remove: (index) => setLinks((current) => current.filter((_, i) => i !== index)),
      move: (index, offset) =>
        setLinks((current) => {
          const newIndex = index + offset;
          if (newIndex < 0 || newIndex >= current.length) return current;
          const updated = [...current];
          const [item] = updated.splice(index, 1);
          updated.splice(newIndex, 0, item);
          return updated;
        }),
    };
  }
  const readOrBuyHandlers = makeLinkListHandlers(setReadOrBuyLinks, "read_or_buy");
  const trackHandlers = makeLinkListHandlers(setTrackLinks, "track");
  const readOrBuySiteOptions = linkSites
    .filter((s) => s.category === "read_or_buy")
    .map((s) => ({ value: s.id, label: s.name, icon: s.icon_path }));
  const trackSiteOptions = linkSites
    .filter((s) => s.category === "track")
    .map((s) => ({ value: s.id, label: s.name, icon: s.icon_path }));

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
      formData.append("status", status);
      const toStringArray = (items) => items.map((item) => item.value.trim()).filter(Boolean);
      formData.append("authors", JSON.stringify(toStringArray(authors)));
      formData.append("artists", JSON.stringify(toStringArray(artists)));
      formData.append("alternative_titles", JSON.stringify(toStringArray(alternativeTitles)));
      const links = [
        ...readOrBuyLinks.map((l) => ({ ...l, category: "read_or_buy" })),
        ...trackLinks.map((l) => ({ ...l, category: "track" })),
      ].filter((l) => l.url.trim());
      formData.append("links", JSON.stringify(links));
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

        <div className="settings-row">
          <span className="settings-label">{t("editManga.status")}</span>
          <div className="settings-toggle-group">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={status === opt ? "active" : ""}
                onClick={() => setStatus(opt)}
              >
                {t(`status.${opt}`)}
              </button>
            ))}
          </div>
        </div>

        <StringListEditor
          label={t("editManga.author")}
          items={authors}
          handlers={authorHandlers}
          drag={authorsDrag}
          placeholder={t("editManga.authorPlaceholder")}
          addLabel={t("editManga.addAuthor")}
        />

        <StringListEditor
          label={t("editManga.artist")}
          items={artists}
          handlers={artistHandlers}
          drag={artistsDrag}
          placeholder={t("editManga.artistPlaceholder")}
          addLabel={t("editManga.addArtist")}
        />

        <StringListEditor
          label={t("editManga.alternativeTitles")}
          items={alternativeTitles}
          handlers={altTitleHandlers}
          drag={altTitlesDrag}
          placeholder={t("editManga.alternativeTitlePlaceholder")}
          addLabel={t("editManga.addAlternativeTitle")}
        />

        <div className="settings-row">
          <span className="settings-label">{t("editManga.readOrBuy")}</span>
          {readOrBuyLinks.length > 1 && <p className="reorder-hint">{t("editManga.linksReorderHint")}</p>}
          {readOrBuyLinks.length > 0 && (
            <div className="site-links-list">
              {readOrBuyLinks.map((link, index) => (
                <div
                  className={`site-link-row${readOrBuyDrag.draggingId === link.id ? " site-link-row-dragging" : ""}`}
                  key={link.id}
                  draggable={readOrBuyDrag.dragArmed}
                  onDragStart={readOrBuyDrag.handleDragStart(link.id)}
                  onDragOver={readOrBuyDrag.handleDragOver(link.id)}
                  onDrop={readOrBuyDrag.handleDrop}
                  onDragEnd={readOrBuyDrag.disarmDrag}
                >
                  <span
                    className="drag-handle material-symbols-outlined"
                    onMouseDown={readOrBuyDrag.armDrag}
                    onMouseUp={readOrBuyDrag.disarmDrag}
                    aria-hidden="true"
                  >
                    drag_indicator
                  </span>
                  <SearchableSelect
                    options={readOrBuySiteOptions}
                    value={link.site_id}
                    onChange={(value) => readOrBuyHandlers.update(index, "site_id", value)}
                    placeholder={t("editManga.selectSite")}
                    searchPlaceholder={t("editManga.searchSite")}
                    emptyLabel={t("editManga.noSitesFound")}
                  />
                  <input
                    value={link.url}
                    placeholder={t("editManga.urlPlaceholder")}
                    onChange={(e) => readOrBuyHandlers.update(index, "url", e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => readOrBuyHandlers.move(index, -1)}
                    disabled={index === 0}
                    aria-label={t("common.moveUp")}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => readOrBuyHandlers.move(index, 1)}
                    disabled={index === readOrBuyLinks.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => readOrBuyHandlers.remove(index)}
                    aria-label={t("common.remove")}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {readOrBuySiteOptions.length === 0 ? (
            <p className="reorder-hint">{t("editManga.noSitesConfigured")}</p>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={readOrBuyHandlers.add}>
              {t("editManga.addLink")}
            </button>
          )}
        </div>

        <div className="settings-row">
          <span className="settings-label">{t("editManga.track")}</span>
          {trackLinks.length > 1 && <p className="reorder-hint">{t("editManga.linksReorderHint")}</p>}
          {trackLinks.length > 0 && (
            <div className="site-links-list">
              {trackLinks.map((link, index) => (
                <div
                  className={`site-link-row${trackDrag.draggingId === link.id ? " site-link-row-dragging" : ""}`}
                  key={link.id}
                  draggable={trackDrag.dragArmed}
                  onDragStart={trackDrag.handleDragStart(link.id)}
                  onDragOver={trackDrag.handleDragOver(link.id)}
                  onDrop={trackDrag.handleDrop}
                  onDragEnd={trackDrag.disarmDrag}
                >
                  <span
                    className="drag-handle material-symbols-outlined"
                    onMouseDown={trackDrag.armDrag}
                    onMouseUp={trackDrag.disarmDrag}
                    aria-hidden="true"
                  >
                    drag_indicator
                  </span>
                  <SearchableSelect
                    options={trackSiteOptions}
                    value={link.site_id}
                    onChange={(value) => trackHandlers.update(index, "site_id", value)}
                    placeholder={t("editManga.selectSite")}
                    searchPlaceholder={t("editManga.searchSite")}
                    emptyLabel={t("editManga.noSitesFound")}
                  />
                  <input
                    value={link.url}
                    placeholder={t("editManga.urlPlaceholder")}
                    onChange={(e) => trackHandlers.update(index, "url", e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => trackHandlers.move(index, -1)}
                    disabled={index === 0}
                    aria-label={t("common.moveUp")}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => trackHandlers.move(index, 1)}
                    disabled={index === trackLinks.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => trackHandlers.remove(index)}
                    aria-label={t("common.remove")}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {trackSiteOptions.length === 0 ? (
            <p className="reorder-hint">{t("editManga.noSitesConfigured")}</p>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={trackHandlers.add}>
              {t("editManga.addLink")}
            </button>
          )}
        </div>

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
              <label className={`visibility-role-checkbox${visibilityLocked ? " visibility-role-checkbox-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={visibleRoles.includes("uploader")}
                  onChange={() => toggleVisibleRole("uploader")}
                  disabled={visibilityLocked}
                />
                {t("role.uploader")}
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
          {tags.length > 1 && <p className="reorder-hint">{t("editManga.tagsReorderHint")}</p>}
          {tags.length > 0 && (
            <div className="manga-tags">
              {tags.map((tg, tagIndex) => (
                <span
                  key={tg.id}
                  className={`tag-chip-wrap${draggingTagId === tg.id ? " tag-chip-wrap-dragging" : ""}`}
                  draggable={tagDragArmed}
                  onDragStart={handleTagDragStart(tg.id)}
                  onDragOver={handleTagDragOver(tg.id)}
                  onDrop={handleTagDrop}
                  onDragEnd={disarmTagDrag}
                >
                  <span
                    className="drag-handle material-symbols-outlined"
                    onMouseDown={armTagDrag}
                    onMouseUp={disarmTagDrag}
                    aria-hidden="true"
                  >
                    drag_indicator
                  </span>
                  <span
                    className="tag-chip"
                    style={tg.color ? { background: tg.color, color: "#fff" } : undefined}
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(tg.name) }}
                  />
                  <button
                    type="button"
                    className="tag-chip-move"
                    onClick={() => moveTagByOffset(tg.id, -1)}
                    disabled={tagIndex === 0}
                    aria-label={t("common.moveUp")}
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className="tag-chip-move"
                    onClick={() => moveTagByOffset(tg.id, 1)}
                    disabled={tagIndex === tags.length - 1}
                    aria-label={t("common.moveDown")}
                  >
                    &darr;
                  </button>
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

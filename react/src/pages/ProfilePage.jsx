import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useDragReorder } from "../hooks/useDragReorder";
import MangaCard from "../components/MangaCard";
import MarkdownEditor from "../components/MarkdownEditor";
import ImageCropper from "../components/ImageCropper";
import UploadProgressBar from "../components/UploadProgressBar";

// Must match .profile-banner's "aspect-ratio: 16/9; max-height: 320px" in
// App.css — on any viewport wide enough that 16:9 would exceed 320px tall,
// the max-height wins and the banner actually renders wider than 16:9. The
// crop tool needs to select in that same real ratio, or what you crop and
// what ends up on screen won't match.
const BANNER_MIN_ASPECT = 16 / 9;
const BANNER_MAX_HEIGHT = 320;

export default function ProfilePage() {
  const { userId } = useParams();
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();

  const isSelf = !userId || (user != null && Number(userId) === user.id);
  const targetId = isSelf ? user?.id : userId;

  const bannerWrapRef = useRef(null);

  const [publicProfile, setPublicProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [avatarPickerFile, setAvatarPickerFile] = useState(null);
  const [bannerPickerFile, setBannerPickerFile] = useState(null);
  const [bannerAspect, setBannerAspect] = useState(BANNER_MIN_ASPECT);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingKind, setUploadingKind] = useState(null);

  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const [linkCopied, setLinkCopied] = useState(false);
  const [arrangingWorks, setArrangingWorks] = useState(false);

  useEffect(() => {
    if (!targetId) return;
    setPublicProfile(null);
    setNotFound(false);
    setArrangingWorks(false);
    api.get(`/users/${targetId}`).then(setPublicProfile).catch(() => setNotFound(true));
  }, [targetId]);

  // Only the pinned works are reorderable — the rest keep their automatic
  // newest-first order, so the drag list is spliced back into the full works
  // array (pinned first) exactly the way MangaOrderPanel handles the admin
  // "All Manga" pins.
  const pinnedWorks = (publicProfile?.works || []).filter((m) => m.profile_pin_position != null);

  const setPinnedWorks = (updater) => {
    setPublicProfile((current) => {
      if (!current) return current;
      const currentPinned = current.works.filter((m) => m.profile_pin_position != null);
      const currentUnpinned = current.works.filter((m) => m.profile_pin_position == null);
      const nextPinned = typeof updater === "function" ? updater(currentPinned) : updater;
      return { ...current, works: [...nextPinned, ...currentUnpinned] };
    });
  };

  const { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset } =
    useDragReorder({
      items: pinnedWorks,
      setItems: setPinnedWorks,
      onCommit: (orderedMangaIds) => api.patch("/users/me/works/reorder", { orderedMangaIds }),
    });

  useEffect(() => {
    if (isSelf && user) {
      setDisplayName(user.display_name || "");
      setBio(user.bio || "");
      setEmail(user.email || "");
    }
  }, [isSelf, user]);

  useDocumentTitle(isSelf ? user?.display_name || user?.username : publicProfile?.display_name || publicProfile?.username);

  if (!userId && !user) return <Navigate to="/login" replace />;
  if (!userId && user) return <Navigate to={`/users/${user.id}`} replace />;
  if (notFound) return <div className="page-loading">{t("profile.notFound")}</div>;
  if (!publicProfile || (isSelf && !user)) return <div className="page-loading">{t("common.loading")}</div>;

  const avatarPath = isSelf ? user.avatar_path : publicProfile.avatar_path;
  const bannerPath = isSelf ? user.banner_path : publicProfile.banner_path;
  const role = isSelf ? user.role : publicProfile.role;
  const username = isSelf ? user.username : publicProfile.username;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const updated = await api.patch("/users/me", { display_name: displayName, bio, email });
      updateUser(updated);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    setVerificationError("");
    setSendingVerification(true);
    try {
      await api.post("/auth/send-verification");
      setVerificationSent(true);
    } catch (err) {
      setVerificationError(err.message);
    } finally {
      setSendingVerification(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/users/${user.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Pinning appends to the end of the pinned group; unpinning drops the work
  // back into the automatic newest-first tail. Both re-sort the array the
  // same way the server's ORDER BY does, so the grid matches a reload.
  const sortWorks = (works) =>
    [...works].sort((a, b) => {
      if ((a.profile_pin_position == null) !== (b.profile_pin_position == null)) {
        return a.profile_pin_position == null ? 1 : -1;
      }
      if (a.profile_pin_position != null) return a.profile_pin_position - b.profile_pin_position;
      return 0;
    });

  const handlePinWork = async (mangaId) => {
    const pinned = await api.patch(`/users/me/works/${mangaId}/pin`);
    setPublicProfile((current) => ({
      ...current,
      works: sortWorks(current.works.map((m) => (m.id === mangaId ? { ...m, ...pinned } : m))),
    }));
  };

  const handleUnpinWork = async (mangaId) => {
    await api.del(`/users/me/works/${mangaId}/pin`);
    setPublicProfile((current) => ({
      ...current,
      works: sortWorks(
        current.works.map((m) => (m.id === mangaId ? { ...m, profile_pin_position: null } : m))
      ),
    }));
  };

  const handleCropped = async (blob, kind) => {
    setUploadingKind(kind);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append(kind, blob, `${kind}.jpg`);
      const updated = await api.postForm(`/users/me/${kind}`, formData, setUploadProgress);
      updateUser(updated);
    } finally {
      setUploadingKind(null);
      setAvatarPickerFile(null);
      setBannerPickerFile(null);
    }
  };

  return (
    <div className="page profile-page">
      <div className="profile-banner-wrap" ref={bannerWrapRef}>
        {bannerPath ? (
          <img src={bannerPath} alt="" className="profile-banner" />
        ) : (
          <div className="profile-banner profile-banner-placeholder" />
        )}
        {isSelf && (
          <label className="profile-edit-overlay-btn profile-banner-edit" aria-label={t("profile.changeBanner")}>
            <span className="material-symbols-outlined">edit</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const width = bannerWrapRef.current?.getBoundingClientRect().width || 0;
                setBannerAspect(width > 0 ? Math.max(BANNER_MIN_ASPECT, width / BANNER_MAX_HEIGHT) : BANNER_MIN_ASPECT);
                setBannerPickerFile(file);
              }}
            />
          </label>
        )}

        <div className="profile-avatar-wrap">
          {avatarPath ? (
            <img src={avatarPath} alt={username} className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar-placeholder" />
          )}
          {isSelf && (
            <label className="profile-edit-overlay-btn profile-avatar-edit" aria-label={t("profile.changeAvatar")}>
              <span className="material-symbols-outlined">edit</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && setAvatarPickerFile(e.target.files[0])}
              />
            </label>
          )}
        </div>
      </div>

      <div className="profile-header-info">
        <h1>{isSelf ? displayName || username : publicProfile.display_name || username}</h1>
        <span className="role-badge">{t(`role.${role}`)}</span>
        {isSelf && (
          <button type="button" className="btn btn-ghost btn-sm profile-copy-link-btn" onClick={handleCopyLink}>
            <span className="material-symbols-outlined">{linkCopied ? "check" : "link"}</span>
            {linkCopied ? t("profile.linkCopied") : t("profile.copyLink")}
          </button>
        )}
      </div>

      {uploadingKind && <UploadProgressBar percent={uploadProgress} />}

      {isSelf ? (
        <form className="upload-form profile-edit-form" onSubmit={handleSave}>
          <label>
            {t("profile.displayName")}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user.username}
            />
          </label>

          <label>
            {t("profile.email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={user.auth_provider === "google"}
            />
          </label>
          {user.auth_provider === "google" && (
            <p className="profile-email-locked-hint">{t("profile.emailGoogleLocked")}</p>
          )}

          {/* Google's email is locked and pre-verified above, so it never needs
              this block. Facebook doesn't guarantee an email at all — it may
              be absent, or the user may type one in here by hand — so it
              follows the same verify-your-own-address flow as a local
              account rather than Google's fully-managed one. */}
          {(user.auth_provider === "local" || user.auth_provider === "facebook") &&
            (user.email_verified ? (
              <p className="profile-email-status profile-email-verified">
                <span className="material-symbols-outlined">check_circle</span>
                {t("profile.emailVerified")}
              </p>
            ) : (
              <div className="profile-email-status profile-email-unverified">
                <p>
                  <span className="material-symbols-outlined">error</span>
                  {t("profile.emailNotVerified")}
                </p>
                {verificationSent ? (
                  <span className="profile-verification-sent">{t("profile.verificationSent")}</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleSendVerification}
                    disabled={sendingVerification}
                  >
                    {t("profile.sendVerification")}
                  </button>
                )}
              </div>
            ))}
          {verificationError && <p className="form-error">{verificationError}</p>}

          <label>
            {t("profile.bio")}
            <MarkdownEditor value={bio} onChange={setBio} />
          </label>

          {saveError && <p className="form-error">{saveError}</p>}

          <button type="submit" className="btn btn-accent" disabled={saving}>
            {t("profile.save")}
          </button>
        </form>
      ) : (
        publicProfile.bio && (
          <div
            className="manga-description"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(publicProfile.bio) }}
          />
        )
      )}

      <div className="profile-section-header">
        <h2>{t("profile.works")}</h2>
        {isSelf && publicProfile.works.length > 0 && (
          <button
            type="button"
            className={`corner-icon-btn${arrangingWorks ? " corner-icon-btn-active" : ""}`}
            onClick={() => setArrangingWorks((v) => !v)}
            aria-label={arrangingWorks ? t("profile.doneArranging") : t("profile.arrangeWorks")}
            title={arrangingWorks ? t("profile.doneArranging") : t("profile.arrangeWorks")}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {arrangingWorks ? "check" : "push_pin"}
            </span>
          </button>
        )}
      </div>

      {publicProfile.works.length === 0 ? (
        <p className="empty-state">{t("profile.worksEmpty")}</p>
      ) : arrangingWorks ? (
        <>
          <p className="reorder-hint">{t("profile.pinHint")}</p>
          <div className="profile-works-arrange">
            {publicProfile.works.map((m, index) => {
              const isPinned = m.profile_pin_position != null;
              return (
                <div
                  key={m.id}
                  className={`profile-work-tile${isPinned ? " profile-work-tile-pinned" : ""}${
                    draggingId === m.id ? " profile-work-tile-dragging" : ""
                  }`}
                  draggable={isPinned && dragArmed}
                  onDragStart={isPinned ? handleDragStart(m.id) : undefined}
                  onDragOver={isPinned ? handleDragOver(m.id) : undefined}
                  onDrop={isPinned ? handleDrop : undefined}
                  onDragEnd={isPinned ? disarmDrag : undefined}
                >
                  {isPinned && (
                    <span
                      className="drag-handle material-symbols-outlined"
                      onMouseDown={armDrag}
                      onMouseUp={disarmDrag}
                      aria-hidden="true"
                    >
                      drag_indicator
                    </span>
                  )}
                  {/* Pin toggle lives on the card itself now (top-left
                      corner, same slot the read-only badge uses for every
                      other viewer) — up/down stay as separate controls
                      since "drag" doesn't exist as a gesture on touch. */}
                  <MangaCard
                    manga={m}
                    pinnable
                    onTogglePin={() => (isPinned ? handleUnpinWork(m.id) : handlePinWork(m.id))}
                  />
                  {isPinned && (
                    <div className="profile-work-tile-controls">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => moveByOffset(m.id, -1)}
                        disabled={index === 0}
                        aria-label={t("common.moveUp")}
                      >
                        &uarr;
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => moveByOffset(m.id, 1)}
                        disabled={index === pinnedWorks.length - 1}
                        aria-label={t("common.moveDown")}
                      >
                        &darr;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="manga-grid">
          {publicProfile.works.map((m) => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}

      {/* Libraries the owner chose to surface here (see show_on_profile in
          list.routes.js). Absent entirely for a profile with none, rather
          than showing an empty-state a visitor can't act on. */}
      {publicProfile.lists?.length > 0 && (
        <>
          <hr className="profile-section-divider" />
          <div className="profile-section-header">
            <h2>{t("profile.libraries")}</h2>
          </div>
          <div className="library-list">
            {publicProfile.lists.map((list) => (
              <Link key={list.id} to={`/library/${list.id}`} className="library-card">
                <div className="library-card-header">
                  <h3 dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(list.title) }} />
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
                    {list.preview.map((m) => (
                      <div key={m.id} className="library-preview-item">
                        {/* Not lazy — see the note in MyLibraryPage: lazy
                            images inside this horizontal scroller never
                            resolve. */}
                        {m.cover_path ? (
                          <img src={m.cover_path} alt="" draggable={false} />
                        ) : (
                          <div className="library-card-preview-placeholder" />
                        )}
                        <span
                          className="library-preview-title"
                          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(m.title) }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {avatarPickerFile && (
        <ImageCropper
          file={avatarPickerFile}
          aspect={1}
          onCancel={() => setAvatarPickerFile(null)}
          onCropped={(blob) => handleCropped(blob, "avatar")}
        />
      )}
      {bannerPickerFile && (
        <ImageCropper
          file={bannerPickerFile}
          aspect={bannerAspect}
          onCancel={() => setBannerPickerFile(null)}
          onCropped={(blob) => handleCropped(blob, "banner")}
        />
      )}
    </div>
  );
}

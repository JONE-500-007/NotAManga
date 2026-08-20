import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { renderInlineMarkdown } from "../utils/renderMarkdown";

// `pinnable` turns the pin corner into a click target (profile arrange
// mode); otherwise it's a read-only badge that only appears when the work
// is actually pinned — shown to every visitor, not just the owner, so a
// pinned work is recognizable from anyone's view of the profile.
export default function MangaCard({ manga, pinnable = false, onTogglePin }) {
  const { t } = useLanguage();
  const isPinned = manga.profile_pin_position != null;

  return (
    <Link to={`/manga/${manga.id}`} className="manga-card">
      <div className="manga-card-cover">
        {manga.cover_path ? (
          <img src={manga.cover_path} alt={manga.title} draggable={false} />
        ) : (
          <div className="manga-card-placeholder" />
        )}
        {manga.is_private && (
          <span className="manga-card-private-badge material-symbols-outlined" aria-hidden="true">
            lock
          </span>
        )}
        {(isPinned || pinnable) &&
          (pinnable ? (
            <button
              type="button"
              className={`manga-card-pin-badge material-symbols-outlined${isPinned ? " manga-card-pin-badge-active" : ""}`}
              // The card itself is a Link — without stopping the click here,
              // toggling the pin would also navigate to the manga page.
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin?.();
              }}
              aria-pressed={isPinned}
              aria-label={isPinned ? t("profile.unpin") : t("profile.pin")}
              title={isPinned ? t("profile.unpin") : t("profile.pin")}
            >
              push_pin
            </button>
          ) : (
            <span
              className="manga-card-pin-badge manga-card-pin-badge-active material-symbols-outlined"
              aria-label={t("profile.pinnedBadge")}
              title={t("profile.pinnedBadge")}
            >
              push_pin
            </span>
          ))}
      </div>
      <div className="manga-card-title" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(manga.title) }} />
    </Link>
  );
}

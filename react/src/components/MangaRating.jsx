import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

const RATING_LEVELS = [
  { value: 5, labelKey: "rating.level5" },
  { value: 4, labelKey: "rating.level4" },
  { value: 3, labelKey: "rating.level3" },
  { value: 2, labelKey: "rating.level2" },
  { value: 1, labelKey: "rating.level1" },
];

const STAR_SLOTS = [1, 2, 3, 4, 5];

export default function MangaRating({ mangaId, canRate, average, count, userRating: initialUserRating }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRating, setUserRating] = useState(initialUserRating);
  const [ratingAverage, setRatingAverage] = useState(average);
  const [ratingCount, setRatingCount] = useState(count);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const applyRating = async (rating) => {
    setSaving(true);
    setOpen(false);
    try {
      const updated =
        rating === null
          ? await api.del(`/manga/${mangaId}/rating`)
          : await api.patch(`/manga/${mangaId}/rating`, { rating });
      setUserRating(updated.user_rating);
      setRatingAverage(updated.rating_average);
      setRatingCount(updated.rating_count);
    } finally {
      setSaving(false);
    }
  };

  const currentLevel = RATING_LEVELS.find((level) => level.value === userRating);

  return (
    <div className="manga-rating">
      <span className="manga-rating-summary">
        <span className="material-symbols-outlined" aria-hidden="true">
          star
        </span>
        {ratingCount > 0 ? (
          <>
            {ratingAverage.toFixed(1)}
            <span className="manga-rating-count">({ratingCount})</span>
          </>
        ) : (
          <span className="manga-rating-count">{t("rating.noRatings")}</span>
        )}
      </span>

      {canRate ? (
        <div className="manga-rating-menu" ref={menuRef}>
          <button
            type="button"
            className={`btn btn-ghost btn-sm${currentLevel ? " manga-rating-button-rated" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            disabled={saving}
          >
            {currentLevel ? t(currentLevel.labelKey) : t("rating.rate")}
            <span className={`admin-menu-chevron${open ? " open" : ""}`}>&#9662;</span>
          </button>
          {open && (
            <div className="admin-menu-panel manga-rating-panel">
              {RATING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`admin-menu-item manga-rating-item${
                    userRating === level.value ? " manga-rating-item-active" : ""
                  }`}
                  onClick={() => applyRating(level.value)}
                  aria-label={`${t(level.labelKey)} (${level.value}/5)`}
                >
                  <span>{t(level.labelKey)}</span>
                  <span className="manga-rating-item-stars" aria-hidden="true">
                    {STAR_SLOTS.map((slot) => (
                      <span
                        key={slot}
                        className={`material-symbols-outlined${
                          slot <= level.value ? " manga-rating-star-filled" : ""
                        }`}
                      >
                        star
                      </span>
                    ))}
                  </span>
                </button>
              ))}
              {userRating != null && (
                <button
                  type="button"
                  className="admin-menu-item manga-rating-remove"
                  onClick={() => applyRating(null)}
                >
                  {t("rating.removeRating")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="login-hint">{t("rating.loginHint")}</span>
      )}
    </div>
  );
}

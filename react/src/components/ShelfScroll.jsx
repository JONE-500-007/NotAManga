import { useHorizontalScroll } from "../hooks/useHorizontalScroll";
import { useLanguage } from "../context/LanguageContext";

export default function ShelfScroll({ className, children }) {
  const { t } = useLanguage();
  const { ref, canScrollLeft, canScrollRight, scrollByPage } = useHorizontalScroll();

  return (
    <div className="shelf-scroll-wrap">
      <div ref={ref} className={className}>
        {children}
      </div>
      <button
        type="button"
        className={`shelf-scroll-arrow shelf-scroll-arrow--left${canScrollLeft ? " is-visible" : ""}`}
        onClick={() => scrollByPage(-1)}
        aria-label={t("browse.scrollLeft")}
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          chevron_left
        </span>
      </button>
      <button
        type="button"
        className={`shelf-scroll-arrow shelf-scroll-arrow--right${canScrollRight ? " is-visible" : ""}`}
        onClick={() => scrollByPage(1)}
        aria-label={t("browse.scrollRight")}
        tabIndex={canScrollRight ? 0 : -1}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          chevron_right
        </span>
      </button>
    </div>
  );
}

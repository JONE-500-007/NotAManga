import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useReaderSettings } from "../hooks/useReaderSettings";
import ReaderSettingsPanel from "../components/ReaderSettingsPanel";

const HIDE_DELAY_MS = 2500;

function formatGroupLabel(group) {
  if (!group) return "";
  const first = group.startIndex + 1;
  const last = group.startIndex + group.pages.length;
  return first === last ? `${first}` : `${first}-${last}`;
}

export default function ReaderPage() {
  const { mangaId, chapterId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { settings, setMode, setDoublePage, setDirection, setShowProgress } = useReaderSettings();

  const [chapter, setChapter] = useState(null);
  const [chapterList, setChapterList] = useState([]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [visibleGroupIndex, setVisibleGroupIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);

  const groupRefs = useRef([]);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    setChapter(null);
    setGroupIndex(0);
    setVisibleGroupIndex(0);
    groupRefs.current = [];
    api.get(`/manga/${mangaId}/chapters/${chapterId}`).then(setChapter);
  }, [mangaId, chapterId]);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then((data) => setChapterList(data.chapters));
  }, [mangaId]);

  const groupSize = settings.doublePage ? 2 : 1;
  const totalPages = chapter?.pages.length ?? 0;

  const groups = useMemo(() => {
    if (!chapter) return [];
    const result = [];
    for (let i = 0; i < chapter.pages.length; i += groupSize) {
      const groupPages = chapter.pages.slice(i, i + groupSize);
      result.push({
        startIndex: i,
        pages: settings.direction === "rtl" ? [...groupPages].reverse() : groupPages,
      });
    }
    return result;
  }, [chapter, groupSize, settings.direction]);

  useEffect(() => {
    setGroupIndex((i) => Math.min(i, Math.max(0, groups.length - 1)));
  }, [groups.length]);

  const goToPrevGroup = useCallback(() => {
    if (groupIndex === 0) {
      if (chapter?.prevChapterId) navigate(`/manga/${mangaId}/chapter/${chapter.prevChapterId}`);
      return;
    }
    setGroupIndex((i) => Math.max(0, i - 1));
  }, [groupIndex, chapter, mangaId, navigate]);

  const goToNextGroup = useCallback(() => {
    if (groupIndex + 1 >= groups.length) {
      if (chapter?.nextChapterId) navigate(`/manga/${mangaId}/chapter/${chapter.nextChapterId}`);
      return;
    }
    setGroupIndex((i) => i + 1);
  }, [groupIndex, groups.length, chapter, mangaId, navigate]);

  const goLeftZone = settings.direction === "ltr" ? goToPrevGroup : goToNextGroup;
  const goRightZone = settings.direction === "ltr" ? goToNextGroup : goToPrevGroup;

  useEffect(() => {
    if (settings.mode !== "paged" || !chapter) return;
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") goLeftZone();
      if (e.key === "ArrowRight") goRightZone();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [settings.mode, chapter, goLeftZone, goRightZone]);

  useEffect(() => {
    if (settings.mode !== "longStrip" || !chapter) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const best = visible.reduce((a, b) => (a.intersectionRatio > b.intersectionRatio ? a : b));
        const index = Number(best.target.dataset.index);
        setVisibleGroupIndex(index);
      },
      { threshold: [0.25, 0.5, 0.75, 1] }
    );

    groupRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [settings.mode, chapter, groups.length]);

  // Auto-hide chrome (topbar + progress bar) while reading.
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), HIDE_DELAY_MS);
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (!showSettings) scheduleHide();
  }, [showSettings, scheduleHide]);

  useEffect(() => {
    if (showSettings) {
      setChromeVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }
    scheduleHide();
  }, [showSettings, scheduleHide]);

  useEffect(() => {
    window.addEventListener("mousemove", showChrome);
    window.addEventListener("touchstart", showChrome);
    window.addEventListener("scroll", showChrome, true);
    return () => {
      window.removeEventListener("mousemove", showChrome);
      window.removeEventListener("touchstart", showChrome);
      window.removeEventListener("scroll", showChrome, true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showChrome]);

  const currentGroup = settings.mode === "longStrip" ? groups[visibleGroupIndex] : groups[groupIndex];
  const currentPageDisplay = formatGroupLabel(currentGroup);
  const currentLastPage = currentGroup ? currentGroup.startIndex + currentGroup.pages.length : 0;
  const progressPercent = totalPages > 0 ? (currentLastPage / totalPages) * 100 : 0;

  if (!chapter) return <div className="page-loading">{t("common.loading")}</div>;

  const activeGroup = groups[groupIndex];
  const isFirstGroup = groupIndex === 0;
  const isLastGroup = groupIndex + 1 >= groups.length;
  const prevDisabled = isFirstGroup && !chapter.prevChapterId;
  const nextDisabled = isLastGroup && !chapter.nextChapterId;
  const leftZoneDisabled = settings.direction === "ltr" ? prevDisabled : nextDisabled;
  const rightZoneDisabled = settings.direction === "ltr" ? nextDisabled : prevDisabled;

  const chapterOptionLabel = (c) => `Ch. ${c.chapter_number}${c.title ? ` - ${c.title}` : ""}`;
  const hasVolumes = chapterList.some((c) => c.volume != null);
  const volumeGroups = [];
  if (hasVolumes) {
    let lastVolume;
    let currentVolumeGroup = null;
    chapterList.forEach((c) => {
      if (c.volume !== lastVolume) {
        lastVolume = c.volume;
        currentVolumeGroup = { volume: c.volume, chapters: [] };
        volumeGroups.push(currentVolumeGroup);
      }
      currentVolumeGroup.chapters.push(c);
    });
  }

  const handleProgressSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const targetPageIndex = Math.min(totalPages - 1, Math.floor(ratio * totalPages));
    const targetGroupIndex = groups.findIndex(
      (g) => targetPageIndex >= g.startIndex && targetPageIndex < g.startIndex + g.pages.length
    );
    if (targetGroupIndex === -1) return;
    if (settings.mode === "longStrip") {
      groupRefs.current[targetGroupIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setGroupIndex(targetGroupIndex);
    }
  };

  return (
    <div className="reader-page">
      <div className={`reader-chrome${chromeVisible ? "" : " chrome-hidden"}`}>
        <div className="reader-topbar">
          <Link to={`/manga/${mangaId}`} className="btn btn-ghost">
            &larr; <span className="reader-back-label">{t("reader.back")}</span>
          </Link>
          <select
            className="reader-chapter-select"
            value={chapterId}
            onChange={(e) => navigate(`/manga/${mangaId}/chapter/${e.target.value}`)}
            aria-label={t("reader.selectChapter")}
          >
            {hasVolumes
              ? volumeGroups.map((g) => (
                  <optgroup
                    key={`volume-${g.volume ?? "none"}`}
                    label={g.volume != null ? `${t("detail.volume")} ${g.volume}` : t("detail.noVolume")}
                  >
                    {g.chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {chapterOptionLabel(c)}
                      </option>
                    ))}
                  </optgroup>
                ))
              : chapterList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {chapterOptionLabel(c)}
                  </option>
                ))}
          </select>
          <div className="reader-topbar-right">
            <button
              className="btn btn-ghost reader-settings-btn"
              onClick={() => setShowSettings(true)}
              aria-label={t("reader.settings")}
            >
              ⚙
            </button>
          </div>
        </div>
      </div>

      {settings.mode === "paged" ? (
        <div className={`reader-image-area${settings.showProgress ? " reader-content-with-bottom-bar" : ""}`}>
          <button
            className="reader-nav-zone reader-nav-prev"
            onClick={goLeftZone}
            disabled={leftZoneDisabled}
            aria-label={settings.direction === "ltr" ? t("reader.prev") : t("reader.next")}
          />
          <div
            className={`reader-spread${activeGroup?.pages.length > 1 ? " reader-spread-double" : ""}`}
            onClick={showChrome}
          >
            {activeGroup?.pages.map((page) => (
              <img
                key={page.page_number}
                src={page.image_path}
                alt={`Page ${page.page_number}`}
                className="reader-image"
              />
            ))}
          </div>
          <button
            className="reader-nav-zone reader-nav-next"
            onClick={goRightZone}
            disabled={rightZoneDisabled}
            aria-label={settings.direction === "ltr" ? t("reader.next") : t("reader.prev")}
          />
        </div>
      ) : (
        <div className={`reader-longstrip${settings.showProgress ? " reader-content-with-bottom-bar" : ""}`}>
          {groups.map((group, index) => (
            <div
              key={group.startIndex}
              ref={(el) => (groupRefs.current[index] = el)}
              data-index={index}
              className={`reader-spread reader-longstrip-group${group.pages.length > 1 ? " reader-spread-double" : ""}`}
              onClick={showChrome}
            >
              {group.pages.map((page) => (
                <img
                  key={page.page_number}
                  src={page.image_path}
                  alt={`Page ${page.page_number}`}
                  className="reader-image reader-longstrip-image"
                />
              ))}
            </div>
          ))}
          <div className="reader-end-card">
            <p>{t("reader.nextChapterPrompt")}</p>
            {chapter.nextChapterId && (
              <button
                className="btn btn-accent"
                onClick={() => navigate(`/manga/${mangaId}/chapter/${chapter.nextChapterId}`)}
              >
                {t("reader.nextChapter")} &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {settings.showProgress && (
        <div className="reader-bottom-bar">
          <div
            className="reader-bottom-progress-track"
            onClick={handleProgressSeek}
            role="slider"
            aria-label={t("reader.showProgress")}
            aria-valuemin={1}
            aria-valuemax={totalPages}
            aria-valuenow={currentLastPage}
          >
            <div className="reader-bottom-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="reader-bottom-counter">
            {currentPageDisplay} / {totalPages}
          </span>
        </div>
      )}

      {showSettings && (
        <ReaderSettingsPanel
          settings={settings}
          setMode={setMode}
          setDoublePage={setDoublePage}
          setDirection={setDirection}
          setShowProgress={setShowProgress}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

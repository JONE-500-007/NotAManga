import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { renderMarkdown } from "../utils/renderMarkdown";
import { useNovelReaderSettings, FONT_FAMILIES } from "../hooks/useNovelReaderSettings";
import NovelReaderSettingsPanel from "../components/NovelReaderSettingsPanel";

export default function NovelReaderPage() {
  const { mangaId, chapterId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { settings, setTheme, setFontSize, setFontFamily } = useNovelReaderSettings();
  const [chapter, setChapter] = useState(null);
  const [chapterList, setChapterList] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setChapter(null);
    api.get(`/manga/${mangaId}/chapters/${chapterId}`).then(setChapter);
  }, [mangaId, chapterId]);

  useEffect(() => {
    api.get(`/manga/${mangaId}`).then((data) => setChapterList(data.chapters));
  }, [mangaId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  if (!chapter) return <div className="page-loading">{t("common.loading")}</div>;

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

  const contentStyle = {
    "--novel-font-size": `${settings.fontSize}px`,
    ...(FONT_FAMILIES[settings.fontFamily] ? { "--novel-font-family": FONT_FAMILIES[settings.fontFamily] } : {}),
  };

  return (
    <div className={`novel-reader-page novel-reader-theme-${settings.theme}`}>
      <div className="reader-topbar">
        <Link to={`/manga/${mangaId}`} className="btn btn-ghost">
          &larr; <span className="reader-back-label">{t("novelReader.back")}</span>
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
            ⚙ <span className="reader-settings-label">{t("reader.settings")}</span>
          </button>
        </div>
      </div>

      <div className="novel-reader-content" style={contentStyle}>
        {chapter.blocks.map((block) =>
          block.block_type === "text" ? (
            <div
              key={block.id}
              className="novel-reader-text markdown-preview-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }}
            />
          ) : (
            <img key={block.id} src={block.image_path} alt="" className="novel-reader-image" />
          )
        )}
      </div>

      <div className="reader-end-card">
        <p>{t("reader.nextChapterPrompt")}</p>
        <div className="novel-reader-nav-buttons">
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

      {showSettings && (
        <NovelReaderSettingsPanel
          settings={settings}
          setTheme={setTheme}
          setFontSize={setFontSize}
          setFontFamily={setFontFamily}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

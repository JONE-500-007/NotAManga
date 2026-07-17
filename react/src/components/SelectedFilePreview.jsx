import { useLanguage } from "../context/LanguageContext";

export default function SelectedFilePreview({ file, onRemove }) {
  const { t } = useLanguage();
  if (!file) return null;

  return (
    <div className="selected-file-preview">
      <span className="page-file-name">{file.name}</span>
      <button type="button" className="page-file-remove" onClick={onRemove} aria-label={t("common.remove")}>
        &times;
      </button>
    </div>
  );
}

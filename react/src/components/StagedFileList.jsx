import { useLanguage } from "../context/LanguageContext";

export default function StagedFileList({ files, onRemove }) {
  const { t } = useLanguage();
  if (files.length === 0) return null;

  return (
    <ol className="page-file-list">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`}>
          <span className="page-file-name">{file.name}</span>
          <button
            type="button"
            className="page-file-remove"
            onClick={() => onRemove(index)}
            aria-label={t("common.remove")}
          >
            &times;
          </button>
        </li>
      ))}
    </ol>
  );
}

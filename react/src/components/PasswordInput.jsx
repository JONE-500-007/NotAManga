import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function PasswordInput({ value, onChange, ...props }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input type={visible ? "text" : "password"} value={value} onChange={onChange} {...props} />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
        tabIndex={-1}
      >
        <span className="material-symbols-outlined">{visible ? "visibility" : "visibility_off"}</span>
      </button>
    </div>
  );
}

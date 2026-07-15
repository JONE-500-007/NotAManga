import { createContext, useCallback, useContext, useMemo, useState } from "react";
import en from "../i18n/en";
import th from "../i18n/th";

const dictionaries = { en, th };
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem("lang") || "en");

  const setLang = useCallback((next) => {
    localStorage.setItem("lang", next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key) => dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key,
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

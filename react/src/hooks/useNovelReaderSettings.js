import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "novelReaderSettings";
const DEFAULTS = { theme: "dark", fontSize: 17, fontFamily: "default" };
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 30;
export const FONT_SIZE_DEFAULT = DEFAULTS.fontSize;
// "Default" already resolves to Google Sans (see --sans in index.css), so
// it isn't repeated here as its own option — picking it would look
// identical to Default and just confuse readers.
export const FONT_FAMILIES = {
  default: null,
  k2d: "'K2D', var(--sans)",
  chakraPetch: "'Chakra Petch', var(--sans)",
  ibmPlexSansThai: "'IBM Plex Sans Thai', var(--sans)",
  sarabun: "'Sarabun', var(--sans)",
};

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

export function useNovelReaderSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setTheme = useCallback((theme) => {
    setSettings((s) => ({ ...s, theme }));
  }, []);

  const setFontSize = useCallback((fontSize) => {
    const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize));
    setSettings((s) => ({ ...s, fontSize: clamped }));
  }, []);

  const setFontFamily = useCallback((fontFamily) => {
    setSettings((s) => ({ ...s, fontFamily }));
  }, []);

  return { settings, setTheme, setFontSize, setFontFamily };
}

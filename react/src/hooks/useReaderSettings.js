import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readerSettings";
const DEFAULTS = { mode: "paged", doublePage: false, direction: "ltr", showProgress: true };

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULTS, ...stored };
  } catch {
    return DEFAULTS;
  }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setMode = useCallback((mode) => {
    setSettings((s) => ({ ...s, mode }));
  }, []);

  const setDoublePage = useCallback((doublePage) => {
    setSettings((s) => ({ ...s, doublePage }));
  }, []);

  const setDirection = useCallback((direction) => {
    setSettings((s) => ({ ...s, direction }));
  }, []);

  const setShowProgress = useCallback((showProgress) => {
    setSettings((s) => ({ ...s, showProgress }));
  }, []);

  return { settings, setMode, setDoublePage, setDirection, setShowProgress };
}

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readerSettings";
const DEFAULTS = { mode: "longStrip", doublePage: false, direction: "ltr", showProgress: true, zoom: 100 };
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_BUTTON_STEP = 10; // -/+ button click increment
export const ZOOM_SLIDER_STEP = 1; // free-drag granularity

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

  const setZoom = useCallback((zoom) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    setSettings((s) => ({ ...s, zoom: clamped }));
  }, []);

  return { settings, setMode, setDoublePage, setDirection, setShowProgress, setZoom };
}

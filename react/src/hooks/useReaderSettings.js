import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readerSettings";
const DEFAULTS = { mode: "longStrip", doublePage: false, direction: "ltr", showProgress: true, zoom: 100 };
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_BUTTON_STEP = 10; // -/+ button click increment
export const ZOOM_SLIDER_STEP = 1; // free-drag granularity

// Matches the breakpoint the Reader settings panel itself uses to hide the
// zoom/double-page controls on phones (see .settings-row-zoom in App.css).
const MOBILE_BREAKPOINT_QUERY = "(max-width: 640px)";

function loadSettings() {
  const isMobile = typeof window !== "undefined" && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  const defaults = { ...DEFAULTS, showProgress: !isMobile };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaults, ...stored };
  } catch {
    return defaults;
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

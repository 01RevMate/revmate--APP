import { useCallback, useEffect, useSyncExternalStore } from "react";

// Night mode. "system" follows the phone's light/dark setting (and switches
// when the phone does, e.g. at sunset); "light"/"dark" pin it. Saved per
// device. The `.dark` colours live in src/styles.css.

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "revmate:theme";
const CHANGE_EVENT = "revmate:themeChange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the page paints, so night mode never flashes white.
 * Keep it tiny and dependency-free.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

let memoryPref: ThemePref | null = null;

function readPref(): ThemePref {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // fall through
  }
  return memoryPref ?? "system";
}

function systemIsDark() {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function setThemePref(pref: ThemePref) {
  memoryPref = pref;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Private browsing: memoryPref keeps it for this visit.
  }
  apply(pref);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as const);
  const set = useCallback((next: ThemePref) => setThemePref(next), []);
  return [pref, set];
}

/** Mounted once at the root: follows the phone when it switches light/dark. */
export function ThemeWatcher() {
  const [pref] = useThemePref();
  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);
  return null;
}

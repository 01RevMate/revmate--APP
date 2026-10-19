import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";

// RevMate is an all-in-one car app: some people come for the community
// (feed, battles, stories), others just want the practical bits (buying
// parts, fault help, and later fuel prices and EV chargers). This is the
// per-device choice of which one Home shows.

export type HomeMode = "community" | "essentials";

const STORAGE_KEY = "revmate:homeMode";
const CHANGE_EVENT = "revmate:homeModeChange";
// Fallback when storage is blocked, so the switch still works this visit.
let memoryMode: HomeMode | null = null;

function readSaved(): HomeMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "essentials" || saved === "community") return saved;
  } catch {
    // fall through
  }
  return memoryMode;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setHomeMode(mode: HomeMode) {
  memoryMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private browsing etc. — memoryMode keeps it for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useHomeMode(): [HomeMode, (mode: HomeMode) => void] {
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const { user } = useAuth();
  // Until someone picks: visitors land on Essentials (the tools work for
  // anyone, on day one); members start on the Community feed.
  const mode = saved ?? (user ? "community" : "essentials");
  const set = useCallback((next: HomeMode) => setHomeMode(next), []);
  return [mode, set];
}

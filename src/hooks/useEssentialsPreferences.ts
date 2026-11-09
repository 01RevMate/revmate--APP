import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_HOME_PREFERENCES, normaliseHomePreferences, type HomePreferences } from "@/lib/essentialsPreferences";

export function useEssentialsPreferences() {
  const { user } = useAuth();
  const key = `revmate:essentials:${user?.id ?? "visitor"}`;
  const [preferences, setPreferences] = useState(DEFAULT_HOME_PREFERENCES);
  useEffect(() => {
    try { setPreferences(normaliseHomePreferences(JSON.parse(localStorage.getItem(key) ?? "null"))); }
    catch { setPreferences(DEFAULT_HOME_PREFERENCES); }
  }, [key]);
  function save(next: HomePreferences) {
    setPreferences(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep this visit's choice when storage is blocked. */ }
  }
  return { preferences, save };
}
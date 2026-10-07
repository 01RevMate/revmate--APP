import { Moon, Smartphone, Sun } from "lucide-react";
import { useThemePref, type ThemePref } from "@/lib/theme";

const OPTIONS: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "Automatic", icon: Smartphone },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/** Automatic (follows the phone) / Light / Dark. */
export function ThemeSwitch() {
  const [pref, setPref] = useThemePref();
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 rounded-2xl bg-muted p-1"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={pref === id}
          onClick={() => setPref(id)}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
            pref === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

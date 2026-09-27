import { Users, Wrench } from "lucide-react";
import { useHomeMode, type HomeMode } from "@/hooks/useHomeMode";

const OPTIONS: { id: HomeMode; label: string; icon: typeof Users }[] = [
  { id: "community", label: "Community", icon: Users },
  { id: "essentials", label: "Essentials", icon: Wrench },
];

/** Top-of-Home switch between the social feed and the practical hub. */
export function HomeModeSwitch() {
  const [mode, setMode] = useHomeMode();
  return (
    <div
      role="tablist"
      aria-label="Home view"
      className="grid grid-cols-2 rounded-full bg-muted p-1 text-sm"
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => setMode(id)}
          className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 font-semibold transition-colors ${mode === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

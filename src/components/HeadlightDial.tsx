import { useRef, type KeyboardEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemePref, type ThemePref } from "@/lib/theme";

// Appearance as a car-style rotary dial (think VW light switch):
// 1 sun = day (light), 2 AUTO = follow the phone, 3 moon = night (dark).

type Position = { pref: ThemePref; angle: number; label: string; hint: string };

const POSITIONS: Position[] = [
  { pref: "light", angle: -60, label: "Day", hint: "Always light" },
  { pref: "system", angle: 0, label: "AUTO", hint: "Matches your phone" },
  { pref: "dark", angle: 60, label: "Night", hint: "Always dark" },
];

const SIZE = 232;
const CENTER = SIZE / 2;
const LABEL_RADIUS = 92;

export function HeadlightDial() {
  const [pref, setPref] = useThemePref();
  const index = Math.max(
    0,
    POSITIONS.findIndex((p) => p.pref === pref),
  );
  const current = POSITIONS[index]!;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function choose(i: number) {
    const next = POSITIONS[(i + POSITIONS.length) % POSITIONS.length]!;
    setPref(next.pref);
    buttons.current[POSITIONS.indexOf(next)]?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      choose(Math.min(index + 1, POSITIONS.length - 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(Math.max(index - 1, 0));
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div
        role="radiogroup"
        aria-label="Appearance"
        onKeyDown={onKey}
        className="relative mx-auto"
        style={{ width: SIZE, height: SIZE - 36 }}
      >
        {POSITIONS.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const x = CENTER + LABEL_RADIUS * Math.sin(rad);
          const y = CENTER - LABEL_RADIUS * Math.cos(rad);
          const active = i === index;
          return (
            <button
              key={p.pref}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${p.label} — ${p.hint}`}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(i)}
              className={`absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-300 ${
                active
                  ? "text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)] dark:text-amber-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ left: x, top: y }}
            >
              {p.pref === "light" ? (
                <Sun className="size-7" strokeWidth={2.2} />
              ) : p.pref === "system" ? (
                <span className="text-sm font-black tracking-wider">AUTO</span>
              ) : (
                <Moon className="size-7" strokeWidth={2.2} />
              )}
            </button>
          );
        })}

        {/* The knob. Tap it to turn to the next position. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => choose(index === POSITIONS.length - 1 ? 0 : index + 1)}
          className="absolute rounded-full"
          style={{
            left: CENTER - 66,
            top: CENTER - 66,
            width: 132,
            height: 132,
          }}
        >
          {/* Bezel */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-b from-neutral-600 to-neutral-900 shadow-[0_6px_18px_rgba(0,0,0,0.6)]" />
          {/* Knurled grip that turns */}
          <span
            className="absolute inset-[7px] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
            style={{
              transform: `rotate(${current.angle}deg)`,
              background:
                "repeating-conic-gradient(from 0deg, #3a3a3a 0deg 4deg, #262626 4deg 8deg)",
            }}
          >
            <span className="absolute inset-[10px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#5a5a5a,#1d1d1d_70%)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),inset_0_-3px_6px_rgba(0,0,0,0.6)]" />
            {/* Pointer */}
            <span className="absolute left-1/2 top-[14px] h-9 w-1.5 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
          </span>
        </button>
      </div>

      <p className="-mt-2 text-center text-sm font-semibold">{current.label}</p>
      <p className="text-center text-xs text-muted-foreground">{current.hint}</p>
    </div>
  );
}

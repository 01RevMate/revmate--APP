import { useRef, type KeyboardEvent } from "react";
import { useThemePref, type ThemePref } from "@/lib/theme";

// Appearance as a car headlight switch (think VW rotary dial):
// lights off = Light, AUTO = follow the phone, dipped beam = Dark.

type Position = { pref: ThemePref; angle: number; label: string; hint: string };

const POSITIONS: Position[] = [
  { pref: "light", angle: -60, label: "Lights off", hint: "Always light" },
  { pref: "system", angle: 0, label: "AUTO", hint: "Matches your phone" },
  { pref: "dark", angle: 60, label: "Headlights", hint: "Always dark" },
];

const SIZE = 232;
const CENTER = SIZE / 2;
const LABEL_RADIUS = 92;

/** The "0" (lights off) symbol: a small circle. */
function OffMark({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
      {lit && (
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      )}
    </svg>
  );
}

/** Dipped-beam headlight symbol (ISO 7000-0082 style). */
function DippedBeamIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M13 5c4 0 7 3 7 7s-3 7-7 7c-1.1 0-2-3.1-2-7s.9-7 2-7Z" />
      <path d="M9 7.5 3 9.5M9 11 3 13M9 14.5 3 16.5M9 18 3 20" />
    </svg>
  );
}

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

  const headlightsOn = pref === "dark";

  return (
    <div className="flex flex-col items-center">
      {/* The switch panel always looks like a dark dashboard, day or night. */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-950 px-4 pb-5 pt-4 text-neutral-400 shadow-inner ring-1 ring-black/40">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span>Lights</span>
          {/* Green dipped-beam tell-tale, lit when the "headlights" are on. */}
          <span
            className={`flex items-center gap-1 transition-colors duration-300 ${headlightsOn ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "text-neutral-700"}`}
            aria-hidden="true"
          >
            <DippedBeamIcon className="size-5" />
          </span>
        </div>

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
                    ? "text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.85)]"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                style={{ left: x, top: y }}
              >
                {p.pref === "light" ? (
                  <OffMark lit={active} />
                ) : p.pref === "system" ? (
                  <span className="text-sm font-black tracking-wider">AUTO</span>
                ) : (
                  <DippedBeamIcon />
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

        <p className="-mt-2 text-center text-sm font-semibold text-neutral-100">{current.label}</p>
        <p className="text-center text-xs text-neutral-400">{current.hint}</p>
      </div>
    </div>
  );
}

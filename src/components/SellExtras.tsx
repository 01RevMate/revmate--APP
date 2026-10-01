import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ClipboardCheck, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import {
  CONDITION_LABELS,
  lookupDistrict,
  PART_CATEGORY_LABELS,
  type PartDetails,
  type PlaceFix,
  type QualityCheck,
  type RunningCosts,
} from "@/lib/marketDeals";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/** Reg lookup isn't live yet — the field shows what's coming and points to GOV.UK. */
export function RegLookupComingSoon() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Registration lookup</p>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
          Coming soon
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          disabled
          placeholder="AB12 CDE"
          aria-label="Registration (coming soon)"
          className="w-36 rounded-md border-2 border-neutral-800 bg-yellow-300 px-3 py-1.5 text-center font-mono text-sm font-bold uppercase tracking-widest text-neutral-900 opacity-60"
        />
        <p className="text-xs text-muted-foreground">
          Soon you'll type your reg and we'll fill in the details and MOT history for you. For now,
          fill them in below.
        </p>
      </div>
    </div>
  );
}

/** Postcode → district + rough location, so buyers can search by distance. */
export function LocationField({
  value,
  onChange,
  onTown,
}: {
  value: PlaceFix | null;
  onChange: (place: PlaceFix | null) => void;
  onTown?: (town: string) => void;
}) {
  const [text, setText] = useState(value?.district ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (value?.district) setText(value.district);
  }, [value?.district]);

  async function find() {
    if (!text.trim()) {
      onChange(null);
      return;
    }
    setBusy(true);
    try {
      const place = await lookupDistrict(text);
      onChange(place);
      setText(place.district);
      if (place.town) onTown?.(place.town);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find that postcode");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">Your postcode</span>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() =>
            void (text.trim() && text.trim().toUpperCase() !== value?.district && find())
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void find();
            }
          }}
          placeholder="e.g. LS6 2AB or LS6"
          maxLength={8}
          autoComplete="postal-code"
          className={`${input} flex-1 uppercase placeholder:normal-case`}
        />
        <button
          type="button"
          onClick={() => void find()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Find
        </button>
      </div>
      {value ? (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <MapPin className="size-3.5" /> Shown as {value.district}
          {value.town ? ` · ${value.town}` : ""} — buyers see roughly how far away it is
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only the first half (like LS6) is kept, so buyers can search near them. Never your
          address.
        </p>
      )}
    </div>
  );
}

export function PartDetailsFields({
  value,
  onChange,
}: {
  value: PartDetails;
  onChange: (value: PartDetails) => void;
}) {
  const set = (patch: Partial<PartDetails>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Category</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PART_CATEGORY_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ part_category: value.part_category === id ? null : id })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${value.part_category === id ? "border-transparent bg-foreground text-background" : "border-border hover:bg-accent"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Condition</span>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CONDITION_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ item_condition: id })}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${value.item_condition === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">How can buyers get it?</span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.collection_available}
            onChange={(e) => set({ collection_available: e.target.checked })}
            className="size-4 accent-primary"
          />
          Collection
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.postage_available}
            onChange={(e) => set({ postage_available: e.target.checked })}
            className="size-4 accent-primary"
          />
          I can post it
        </label>
        {value.postage_available && (
          <label className="ml-6 flex items-center gap-2 text-sm">
            Postage £
            <input
              type="number"
              min="0"
              max="1000"
              value={value.postage_price ?? ""}
              onChange={(e) =>
                set({ postage_price: e.target.value === "" ? null : Number(e.target.value) })
              }
              placeholder="0 = free"
              className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function RunningCostFields({
  value,
  onChange,
}: {
  value: RunningCosts;
  onChange: (value: RunningCosts) => void;
}) {
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Running costs (optional)</legend>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground">
          MPG
          <input
            type="number"
            min="1"
            max="300"
            step="0.1"
            value={value.mpg ?? ""}
            onChange={(e) => onChange({ ...value, mpg: num(e.target.value) })}
            className={`mt-1 ${input}`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          CO₂ (g/km)
          <input
            type="number"
            min="0"
            max="600"
            value={value.co2_gkm ?? ""}
            onChange={(e) => onChange({ ...value, co2_gkm: num(e.target.value) })}
            className={`mt-1 ${input}`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Insurance group
          <input
            type="number"
            min="1"
            max="50"
            value={value.insurance_group ?? ""}
            onChange={(e) => onChange({ ...value, insurance_group: num(e.target.value) })}
            className={`mt-1 ${input}`}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        CO₂ is on the V5C logbook. Buyers use these to work out what it'll cost to run.
      </p>
    </fieldset>
  );
}

/** A live score with the things that would make the advert better. */
export function ListingQualityMeter({ score, checks }: { score: number; checks: QualityCheck[] }) {
  const tone = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const verdict =
    score >= 80 ? "Great advert" : score >= 50 ? "Good — a few tweaks will help" : "Needs more";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <ClipboardCheck className="size-4 text-primary" /> Advert quality
        </span>
        <span className="font-bold">
          {score}/100 · <span className="font-medium text-muted-foreground">{verdict}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${tone}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`flex items-center gap-1.5 ${c.done ? "text-muted-foreground line-through" : ""}`}
          >
            {c.done ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

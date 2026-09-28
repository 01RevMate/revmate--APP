import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";

export type CarTag = { make: string; model: string; engine: string; year: string };
export const EMPTY_CAR_TAG: CarTag = { make: "", model: "", engine: "", year: "" };

/**
 * Tag the car a post is about — like adding a car to your garage, but
 * quicker, for questions like "thinking of buying one, what are they like?"
 */
export function CarTagFields({
  value,
  onChange,
}: {
  value: CarTag;
  onChange: (next: CarTag) => void;
}) {
  const set = (patch: Partial<CarTag>) => onChange({ ...value, ...patch });
  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">What car is this about?</p>
      <p className="-mt-1 text-xs text-muted-foreground">
        Thinking of buying one or want owners' opinions? Tag it so the right people see it.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <MakeSelect value={value.make} onChange={(make) => set({ make, model: "" })} />
        {value.make ? (
          <ModelSelect make={value.make} value={value.model} onChange={(model) => set({ model })} />
        ) : (
          <div />
        )}
        <input
          value={value.engine}
          onChange={(e) => set({ engine: e.target.value })}
          maxLength={60}
          placeholder="Engine (optional), e.g. 2.0 TDI"
          className={input}
        />
        <input
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear() + 1}
          value={value.year}
          onChange={(e) => set({ year: e.target.value })}
          placeholder="Year (optional)"
          className={input}
        />
      </div>
    </div>
  );
}

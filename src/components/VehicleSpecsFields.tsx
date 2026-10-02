import {
  BODY_LABELS,
  FUEL_LABELS,
  SERVICE_LABELS,
  TRANSMISSION_LABELS,
  type ListingSpecs,
} from "@/lib/vehicleSpecs";

// Same height for text boxes, dropdowns and the date picker, and min-w-0 so
// iPhone Safari's wide native date field can't spill into the next column.
const input =
  "block h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm";

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Yes / No / not saying, for the tick-box style facts buyers filter on. */
function TriState({
  label,
  value,
  onChange,
  yes = "Yes",
  no = "No",
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  yes?: string;
  no?: string;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value == null ? "" : value ? "yes" : "no"}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")}
        className={input}
      >
        <option value="">Not stated</option>
        <option value="yes">{yes}</option>
        <option value="no">{no}</option>
      </select>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Record<string, string>;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={input}
      >
        <option value="">Choose…</option>
        {Object.entries(options).map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The spec sheet sellers fill in, so buyers get the facts they'd expect on
 * AutoTrader and can find the car with Buy & Sell filters. All optional.
 */
export function VehicleSpecsFields({
  value,
  onChange,
}: {
  value: ListingSpecs;
  onChange: (next: ListingSpecs) => void;
}) {
  const set = (patch: Partial<ListingSpecs>) => onChange({ ...value, ...patch });
  const thisYear = new Date().getFullYear();

  return (
    <fieldset className="space-y-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Vehicle details</legend>
      <p className="-mt-2 text-xs text-muted-foreground">
        Adverts with full details get found in more searches. Only fill in what you know is
        accurate.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Year</span>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={thisYear + 1}
            value={value.year ?? ""}
            onChange={(e) => set({ year: num(e.target.value) })}
            className={input}
          />
        </label>
        <Select
          label="Body type"
          value={value.body_type}
          options={BODY_LABELS}
          onChange={(body_type) => set({ body_type })}
        />
        <Select
          label="Fuel"
          value={value.fuel_type}
          options={FUEL_LABELS}
          onChange={(fuel_type) => set({ fuel_type })}
        />
        <Select
          label="Gearbox"
          value={value.transmission}
          options={TRANSMISSION_LABELS}
          onChange={(transmission) => set({ transmission })}
        />
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Engine size (cc)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10000}
            placeholder="e.g. 1998"
            value={value.engine_size_cc ?? ""}
            onChange={(e) => set({ engine_size_cc: num(e.target.value) })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Power (bhp)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={3000}
            value={value.power_bhp ?? ""}
            onChange={(e) => set({ power_bhp: num(e.target.value) })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Colour</span>
          <input
            value={value.colour ?? ""}
            maxLength={30}
            onChange={(e) => set({ colour: e.target.value || null })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Previous owners</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            value={value.previous_owners ?? ""}
            onChange={(e) => set({ previous_owners: num(e.target.value) })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Doors</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            value={value.doors ?? ""}
            onChange={(e) => set({ doors: num(e.target.value) })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Seats</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            value={value.seats ?? ""}
            onChange={(e) => set({ seats: num(e.target.value) })}
            className={input}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">MOT expiry</span>
          <input
            type="date"
            value={value.mot_expiry ?? ""}
            onChange={(e) => set({ mot_expiry: e.target.value || null })}
            className={`${input} appearance-none text-left [&::-webkit-date-and-time-value]:text-left`}
          />
        </label>
        <Select
          label="Service history"
          value={value.service_history}
          options={SERVICE_LABELS}
          onChange={(service_history) => set({ service_history })}
        />
        <TriState
          label="ULEZ compliant"
          value={value.ulez_compliant}
          onChange={(ulez_compliant) => set({ ulez_compliant })}
        />
        <TriState
          label="V5C logbook"
          value={value.v5c_present}
          yes="Present"
          no="Not present"
          onChange={(v5c_present) => set({ v5c_present })}
        />
        <TriState
          label="Modified"
          value={value.modified}
          yes="Modified"
          no="Standard"
          onChange={(modified) => set({ modified })}
        />
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Selling as</span>
          <select
            value={value.seller_type}
            onChange={(e) => set({ seller_type: e.target.value })}
            className={input}
          >
            <option value="private">Private seller</option>
            <option value="trade">Trade / business</option>
          </select>
        </label>
      </div>
      {value.seller_type === "trade" && (
        <p className="text-xs text-muted-foreground">
          Trade sellers must give buyers their full consumer rights under the Consumer Rights Act
          2015.
        </p>
      )}
    </fieldset>
  );
}

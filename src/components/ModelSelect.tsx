import { useEffect, useState } from "react";
import { getModelsForMake } from "@/lib/vehicleModels";

const OTHER = "__other__";

export function ModelSelect({
  make,
  value,
  onChange,
  id,
  required,
}: {
  make: string;
  value: string;
  onChange: (model: string) => void;
  id?: string;
  required?: boolean;
}) {
  const models = getModelsForMake(make);
  const [customMode, setCustomMode] = useState(() => value !== "" && !models.includes(value));

  // A make change invalidates whichever mode was picked for the previous make.
  useEffect(() => {
    setCustomMode(false);
  }, [make]);

  if (models.length === 0 || customMode) {
    return (
      <div className="space-y-1">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={models.length === 0 ? "e.g. Golf GTI" : "Type the model"}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {models.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Choose from list
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      required={required}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">Select a model</option>
      {models.map((model) => (
        <option key={model} value={model}>
          {model}
        </option>
      ))}
      <option value={OTHER}>Other (type your own)…</option>
    </select>
  );
}

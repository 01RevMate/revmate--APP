import { CAR_MAKES } from "@/lib/carLogos";

export function MakeSelect({
  value,
  onChange,
  id,
  required,
}: {
  value: string;
  onChange: (make: string) => void;
  id?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      <option value="">Select a make</option>
      {CAR_MAKES.map((make) => (
        <option key={make} value={make}>
          {make}
        </option>
      ))}
    </select>
  );
}

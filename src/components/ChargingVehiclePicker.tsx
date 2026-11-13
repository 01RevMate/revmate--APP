import { Input } from "@/components/ui/input";
import { chargingCarLabel, vehicleFuel, type ChargingVehicle } from "@/lib/evVehicle";
import type { GarageCar } from "@/lib/garage";

export function ChargingVehiclePicker({ cars, selectedId, vehicle, connector, onSelect, onVehicle, onConnector }: {
  cars: GarageCar[]; selectedId: string; vehicle: ChargingVehicle | null; connector: string;
  onSelect: (id: string) => void; onVehicle: (car: ChargingVehicle) => void; onConnector: (value: string) => void;
}) {
  const field = "lw-field h-12 w-full rounded-xl px-3 text-base";
  const base: ChargingVehicle = vehicle ?? { make: "", model: "", year: null, trim: null, spec: null };
  return <div className="space-y-3 text-left">
    <label className="block text-sm font-semibold">Car needing a charge
      <select aria-label="Car needing a charge" value={selectedId} onChange={(e) => onSelect(e.target.value)} className={`mt-2 ${field}`}>
        {!selectedId && <option value="" disabled>Choose a car</option>}
        {cars.filter((car) => car.ownership_status === "current").map((car) => <option key={car.id} value={car.id}>{chargingCarLabel(car)}{vehicleFuel(car) !== "electric" ? " · check fuel type" : ""}</option>)}
        <option value="other">Another car / helping a friend</option>
      </select>
    </label>
    {selectedId === "other" && <div className="grid grid-cols-2 gap-3">
      <Input aria-label="Car make" placeholder="Make" value={vehicle?.make ?? ""} maxLength={40} onChange={(e) => onVehicle({ ...base, make: e.target.value })} />
      <Input aria-label="Car model" placeholder="Model" value={vehicle?.model ?? ""} maxLength={60} onChange={(e) => onVehicle({ ...base, model: e.target.value })} />
      <Input aria-label="Car year" placeholder="Year (optional)" inputMode="numeric" value={vehicle?.year ?? ""} onChange={(e) => onVehicle({ ...base, year: Number(e.target.value) || null })} />
      <Input aria-label="Car trim" placeholder="Trim (optional)" value={vehicle?.trim ?? ""} maxLength={80} onChange={(e) => onVehicle({ ...base, trim: e.target.value })} />
    </div>}
    {vehicle && selectedId !== "other" && <p className="text-sm text-muted-foreground">{[vehicle.year, vehicle.trim, vehicle.spec, vehicle.engine, vehicleFuel(vehicle)].filter(Boolean).join(" · ")}</p>}
    <label className="block text-sm font-semibold">Your car's AC connection
      <select aria-label="Your car's AC connection" value={connector} onChange={(e) => onConnector(e.target.value)} className={`mt-2 ${field}`}>
        <option value="not_sure">Not sure — confirm with host</option><option value="type2">Type 2</option><option value="three_pin">3-pin portable charging lead</option>
      </select>
    </label>
  </div>;
}
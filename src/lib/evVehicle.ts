import { modelPowertrain } from "./ukModels";

export type ChargingVehicle = {
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  spec: string | null;
  engine?: string | null;
  fuel_type?: string | null;
};

/** Explicit fuel choices win; only unambiguous models fill missing fuel. */
export function vehicleFuel(vehicle: Pick<ChargingVehicle, "make" | "model" | "fuel_type">) {
  return vehicle.fuel_type || modelPowertrain(vehicle.make, vehicle.model);
}

export function chargingCarLabel(vehicle: ChargingVehicle | null): string {
  if (!vehicle) return "";
  return [vehicle.year, vehicle.make.trim(), vehicle.model.trim(), vehicle.trim?.trim()]
    .filter(Boolean).join(" ").slice(0, 80);
}

export function defaultChargingCar<T extends ChargingVehicle & { id: string; ownership_status: string }>(cars: T[]): T | null {
  const current = cars.filter((car) => car.ownership_status === "current");
  return current.find((car) => vehicleFuel(car) === "electric") ?? null;
}

export function chargeMessage(intro: string, questions: string[]): string {
  return [intro.trim(), ...questions].filter(Boolean).join("\n");
}
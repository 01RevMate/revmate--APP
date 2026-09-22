import approvedVehicleMakes from "../../data/approved-vehicle-makes.json";

export const APPROVED_VEHICLE_MAKES = approvedVehicleMakes as readonly string[];

function normalizeVehicleMake(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

const APPROVED_BY_KEY = new Map(
  APPROVED_VEHICLE_MAKES.map((make) => [normalizeVehicleMake(make), make]),
);

// These are names used by the official UK catalogue for the same current brand.
const CATALOGUE_ALIASES = new Map<string, string>([
  ["ds", "DS AUTOMOBILES"],
  ["greatwall", "GWM"],
  ["mercedes", "Mercedes-Benz"],
]);

export function canonicalApprovedVehicleMake(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = normalizeVehicleMake(value);
  return APPROVED_BY_KEY.get(key) ?? CATALOGUE_ALIASES.get(key) ?? null;
}

export function isApprovedVehicleMake(value: string | null | undefined): boolean {
  return canonicalApprovedVehicleMake(value) !== null;
}

export function filterApprovedVehicleMakes<T extends { id: string; name: string }>(
  rows: readonly T[],
): T[] {
  const selected = new Map<string, T>();

  for (const row of rows) {
    const canonicalName = canonicalApprovedVehicleMake(row.name);
    if (!canonicalName) continue;

    const current = selected.get(canonicalName);
    const isExactCatalogueName =
      normalizeVehicleMake(row.name) === normalizeVehicleMake(canonicalName);
    const currentIsExact =
      current && normalizeVehicleMake(current.name) === normalizeVehicleMake(canonicalName);

    if (!current || (isExactCatalogueName && !currentIsExact)) {
      selected.set(canonicalName, { ...row, name: canonicalName });
    }
  }

  return [...selected.values()].sort((a, b) => a.name.localeCompare(b.name));
}

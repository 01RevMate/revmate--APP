/** Miles held back in case the car's range estimate is optimistic. */
export const RANGE_SAFETY_MILES = 10;
/** Furthest the community search ever looks. */
export const MAX_SEARCH_MILES = 30;
/** Nearest edge (miles) of each distance band, by band_order. */
const BAND_START: Record<number, number> = { 1: 0, 2: 2, 3: 5, 4: 15 };

/** How far we'll send someone: their range minus a 10-mile safety buffer, capped at 30. */
export function searchRadius(rangeMiles: number | null): number {
  if (rangeMiles == null || !Number.isFinite(rangeMiles)) return MAX_SEARCH_MILES;
  return Math.max(0, Math.min(MAX_SEARCH_MILES, rangeMiles - RANGE_SAFETY_MILES));
}

/** Keep a host band only if its nearest edge is within the radius (closest band always kept). */
export function bandWithinRadius(bandOrder: number, radius: number): boolean {
  if (bandOrder <= 1) return true;
  return (BAND_START[bandOrder] ?? Infinity) < radius;
}

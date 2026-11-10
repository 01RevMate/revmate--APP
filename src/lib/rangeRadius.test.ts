import { describe, it, expect } from "vitest";
import { searchRadius, bandWithinRadius } from "./rangeRadius";
describe("range-based search radius", () => {
  it("holds back 10 miles", () => expect(searchRadius(25)).toBe(15));
  it("never goes below 0", () => expect(searchRadius(6)).toBe(0));
  it("caps at 30 miles", () => expect(searchRadius(200)).toBe(30));
  it("uses 30 when range unknown", () => expect(searchRadius(null)).toBe(30));
  it("always keeps the nearest band", () => expect(bandWithinRadius(1, 0)).toBe(true));
  it("drops 5–15 mi hosts with 14 miles left", () => expect(bandWithinRadius(3, searchRadius(14))).toBe(false));
  it("keeps 5–15 mi hosts with 20 miles left", () => expect(bandWithinRadius(3, searchRadius(20))).toBe(true));
});

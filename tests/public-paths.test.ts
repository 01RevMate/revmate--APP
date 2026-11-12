import { describe, expect, it } from "bun:test";
import { isPublicPath } from "../src/lib/publicPaths";

describe("Lendawatt public access", () => {
  it("allows the explanation before joining", () => {
    expect(isPublicPath("/ev-chargers/community")).toBe(true);
    expect(isPublicPath("/ev-chargers/community/")).toBe(true);
  });
  it("does not open private nested charger pages", () => {
    for (const path of ["/ev-chargers/community/requests", "/ev-chargers/community/hosting", "/ev-chargers/community/address"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});
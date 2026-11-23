import { describe, expect, it } from "bun:test";
import { isPublicPath } from "../src/lib/publicPaths";

describe("app-wide search browsing", () => {
  it("allows public search without opening member-only destinations", () => {
    expect(isPublicPath("/search")).toBe(true);
    expect(isPublicPath("/search/")).toBe(true);
    expect(isPublicPath("/groups/private-club")).toBe(false);
    expect(isPublicPath("/tags/private-tag")).toBe(false);
    expect(isPublicPath("/messages")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
  });
});

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

describe("legacy Shopify product links", () => {
  it("stays public so the redirect reaches the storefront", () => {
    expect(isPublicPath("/products/audi-rs6-split-the-bill-hoodie.json")).toBe(true);
    expect(isPublicPath("/products/mini-original-troublemakers-hoodie-revmate-edition")).toBe(true);
  });
});
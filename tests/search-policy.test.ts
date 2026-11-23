import { describe, expect, it } from "bun:test";
import { cleanSearchQuery, memberSearchAllowed, searchTools, settleSearch } from "../src/lib/searchPolicy";

describe("app-wide search access", () => {
  it("does not run member-only searches for a signed-out visitor", () => {
    expect(memberSearchAllowed(null)).toBe(false);
    expect(memberSearchAllowed("")).toBe(false);
    expect(memberSearchAllowed("member-123")).toBe(true);
  });
  it("keeps a permission error isolated from other search results", async () => {
    const [denied, allowed] = await Promise.all([
      settleSearch(() => Promise.resolve({ data: [{ id: "private" }], error: { code: "42501" } })),
      settleSearch(() => Promise.resolve({ data: [{ id: "public-advert" }], error: null })),
    ]);
    expect(denied).toEqual({ rows: [], unavailable: true });
    expect(allowed).toEqual({ rows: [{ id: "public-advert" }], unavailable: false });
  });
  it("handles a rejected search without crashing", async () => {
    expect(await settleSearch(() => Promise.reject(new Error("Network unavailable"))))
      .toEqual({ rows: [], unavailable: true });
  });
  it("routes charger discovery through protected existing tools, not host records", () => {
    expect(searchTools("chargers").map((tool) => tool.to)).toEqual([
      "/ev-chargers", "/ev-chargers/community", "/ev-chargers/home",
    ]);
    expect(searchTools("lendawatt").map((tool) => tool.to)).toEqual(["/ev-chargers/community"]);
  });
  it("sanitizes database filter syntax and limits query size", () => {
    expect(cleanSearchQuery("  Golf,(*%) R  ")).toBe("Golf R");
    expect(cleanSearchQuery("a".repeat(150)).length).toBe(100);
  });
});
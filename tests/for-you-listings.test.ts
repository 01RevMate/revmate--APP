import { describe, expect, it } from "bun:test";
import { buildSignals, rankListings } from "../src/lib/forYouListings";

const l = (id: string, make: string | null, model: string | null, type = "car", part_category: string | null = null) => ({
  id, make, model, type, part_category, created_at: "2026-11-01",
});

describe("Latest for sale ranking", () => {
  it("puts parts for a car you own ahead of newer unrelated adverts", () => {
    const signals = buildSignals({ garage: [{ make: "BMW", model: "X5" }], savedFilters: [], viewed: [] });
    const ranked = rankListings([l("new", "Ford", "Fiesta"), l("part", "BMW", "X5", "part"), l("car", "BMW", "M4")], signals);
    expect(ranked.map((x) => x.id)).toEqual(["part", "car", "new"]);
  });
  it("uses saved searches", () => {
    const signals = buildSignals({ garage: [], savedFilters: [{ make: "Audi", model: "RS3" }], viewed: [] });
    expect(rankListings([l("a", "Ford", "Focus"), l("b", "Audi", "RS3")], signals)[0]!.id).toBe("b");
  });
  it("keeps newest-first order when there's nothing to go on", () => {
    const ranked = rankListings([l("1", "Ford", "Ka"), l("2", "VW", "Golf")], buildSignals({ garage: [], savedFilters: [], viewed: [] }));
    expect(ranked.map((x) => x.id)).toEqual(["1", "2"]);
  });
});

import { describe, expect, it } from "bun:test";
// @ts-expect-error plain JS module shared with the import script
import { validateFaultFile } from "../scripts/lib/fault-library.mjs";

const approvedMakes = ["Ford", "Volkswagen"];
const options = { approvedMakes, today: "2026-11-22" };
const good = () => ({
  car: { make: "Ford", model: "Fiesta", generation: "All years" },
  faults: [
    {
      title: "Example fault",
      description: "A description written in our own words that is long enough to be useful to a reader.",
      source_url: "https://example.com/a-real-source",
      last_checked: "2026-11-20",
    },
  ],
});

describe("fault library validation", () => {
  it("accepts a sourced fault with no cost", () => {
    expect(validateFaultFile(good(), options).errors).toEqual([]);
  });
  it("rejects a fault with no source_url", () => {
    const entry = good();
    delete (entry.faults[0] as { source_url?: string }).source_url;
    expect(validateFaultFile(entry, options).errors.join(" ")).toContain("source_url is required");
  });
  it("rejects a non-https source", () => {
    const entry = good();
    entry.faults[0]!.source_url = "http://example.com/x";
    expect(validateFaultFile(entry, options).errors.length).toBeGreaterThan(0);
  });
  it("rejects a cost with no cost_source_url", () => {
    const entry = good() as ReturnType<typeof good> & { faults: Record<string, unknown>[] };
    entry.faults[0]!["typical_cost_low"] = 100;
    entry.faults[0]!["typical_cost_high"] = 300;
    expect(validateFaultFile(entry, options).errors.join(" ")).toContain("needs cost_source_url");
  });
  it("accepts a cost that has its own source", () => {
    const entry = good() as ReturnType<typeof good> & { faults: Record<string, unknown>[] };
    entry.faults[0]!["typical_cost_low"] = 100;
    entry.faults[0]!["typical_cost_high"] = 300;
    entry.faults[0]!["cost_source_url"] = "https://example.com/prices";
    expect(validateFaultFile(entry, options).errors).toEqual([]);
  });
  it("rejects a cost source with no cost, a half cost, and an inverted range", () => {
    for (const patch of [
      { cost_source_url: "https://example.com/p" },
      { typical_cost_low: 100, cost_source_url: "https://example.com/p" },
      { typical_cost_low: 500, typical_cost_high: 100, cost_source_url: "https://example.com/p" },
    ]) {
      const entry = good() as ReturnType<typeof good> & { faults: Record<string, unknown>[] };
      Object.assign(entry.faults[0]!, patch);
      expect(validateFaultFile(entry, options).errors.length).toBeGreaterThan(0);
    }
  });
  it("rejects unknown makes, missing check dates, duplicate titles and empty faults", () => {
    const badMake = good();
    badMake.car.make = "Notamake";
    expect(validateFaultFile(badMake, options).errors.join(" ")).toContain("not an approved");
    const noDate = good() as ReturnType<typeof good> & { faults: Record<string, unknown>[] };
    delete noDate.faults[0]!["last_checked"];
    expect(validateFaultFile(noDate, options).errors.join(" ")).toContain("last_checked");
    const dup = good();
    dup.faults.push({ ...dup.faults[0]! });
    expect(validateFaultFile(dup, options).errors.join(" ")).toContain("duplicate title");
    expect(validateFaultFile({ car: good().car, faults: [] }, options).errors.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "bun:test";
import { DEFAULT_TOOLS, DEFAULT_SECTIONS, moveHomeItem, normaliseHomePreferences } from "../src/lib/essentialsPreferences";

describe("Essentials home choices", () => {
  it("keeps hidden quick buttons and their chosen order", () => {
    const choices = normaliseHomePreferences({ tools: ["chargers", "fuel"], hiddenTools: ["fuel"] });
    expect(choices.tools.slice(0, 2)).toEqual(["chargers", "fuel"]);
    expect(choices.hiddenTools).toEqual(["fuel"]);
  });
  it("moves a section up without losing another section", () => {
    expect(moveHomeItem([...DEFAULT_SECTIONS], "tools", -1)).toEqual(["tools", "cars", "buy", "your-car", "shops", "deals", "listings", "community"]);
  });
  it("discards invalid stored choices and restores available tools", () => {
    const choices = normaliseHomePreferences({ tools: ["bad", "fuel", "fuel"], hiddenSections: ["bad", "deals"] });
    expect(choices.tools).toEqual(["fuel", ...DEFAULT_TOOLS.filter(id => id !== "fuel")]);
    expect(choices.hiddenSections).toEqual(["deals"]);
  });
});
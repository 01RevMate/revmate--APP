export const DEFAULT_TOOLS = ["diagnose", "mechanic", "fuel", "chargers", "sell", "ask"] as const;
export const DEFAULT_SECTIONS = ["cars", "tools", "buy", "your-car", "shops", "deals", "listings", "community"] as const;
export type HomePreferences = {
  tools: string[];
  sections: string[];
  hiddenTools: string[];
  hiddenSections: string[];
};
export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  tools: [...DEFAULT_TOOLS], sections: [...DEFAULT_SECTIONS], hiddenTools: [], hiddenSections: [],
};

export function normaliseHomePreferences(value: unknown): HomePreferences {
  const input = value && typeof value === "object" ? value as Partial<HomePreferences> : {};
  const list = (items: unknown, allowed: readonly string[]) =>
    Array.isArray(items) ? [...new Set(items.filter((id): id is string => typeof id === "string" && allowed.includes(id)))] : [];
  const tools = list(input.tools, DEFAULT_TOOLS);
  const sections = list(input.sections, DEFAULT_SECTIONS);
  return {
    tools: [...tools, ...DEFAULT_TOOLS.filter(id => !tools.includes(id))],
    sections: [...sections, ...DEFAULT_SECTIONS.filter(id => !sections.includes(id))],
    hiddenTools: list(input.hiddenTools, DEFAULT_TOOLS),
    hiddenSections: list(input.hiddenSections, DEFAULT_SECTIONS),
  };
}

export function moveHomeItem(items: string[], id: string, direction: -1 | 1): string[] {
  const from = items.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const other = next[to];
  if (other === undefined) return items;
  next[to] = id;
  next[from] = other;
  return next;
}
import carLogoMap from "./car-logo-map.json";

// 387 manufacturer logos from https://github.com/filippofilip95/car-logos-dataset
// (MIT-licensed dataset; logos remain property of their respective owners),
// served from public/car-logos/<slug>.png as static thumbnails (~10KB each).
const NAME_TO_SLUG: Record<string, string> = {};
const VALID_SLUGS = new Set<string>();
for (const { name, slug } of carLogoMap as { name: string; slug: string }[]) {
  NAME_TO_SLUG[name.toLowerCase()] = slug;
  VALID_SLUGS.add(slug);
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

export function getCarLogoUrl(make: string | null | undefined): string | null {
  if (!make) return null;
  const byName = NAME_TO_SLUG[make.toLowerCase().trim()];
  if (byName) return `/car-logos/${byName}.png`;
  const bySlug = slugify(make);
  return VALID_SLUGS.has(bySlug) ? `/car-logos/${bySlug}.png` : null;
}

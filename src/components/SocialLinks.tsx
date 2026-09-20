import { SOCIAL_PLATFORMS, type Profile } from "@/lib/profiles";

export function SocialLinksDisplay({ profile }: { profile: Profile }) {
  const active = SOCIAL_PLATFORMS.filter((p) => profile[p.key]);
  if (active.length === 0) return null;

  function handleClick(url: string, label: string) {
    if (window.confirm(`You're leaving RevMate to visit ${label}. Continue?`)) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map((platform) => (
        <button
          key={platform.key}
          onClick={() => handleClick(profile[platform.key]!, platform.label)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {platform.label}
        </button>
      ))}
    </div>
  );
}

export function SocialLinksEditor({
  values,
  onChange,
}: {
  values: Record<(typeof SOCIAL_PLATFORMS)[number]["key"], string>;
  onChange: (key: (typeof SOCIAL_PLATFORMS)[number]["key"], value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {SOCIAL_PLATFORMS.map((platform) => (
        <label key={platform.key} className="block space-y-1.5">
          <span className="text-sm font-medium">{platform.label}</span>
          <input
            value={values[platform.key]}
            onChange={(e) => onChange(platform.key, e.target.value)}
            placeholder={platform.placeholder}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      ))}
    </div>
  );
}

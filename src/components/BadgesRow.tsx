import { BADGE_ORDER, BADGES, useBadges } from "@/lib/badges";

/** A profile's badges, in a fixed order. Shows nothing until they have one. */
export function BadgesRow({ userId }: { userId: string }) {
  const badges = useBadges(userId);
  if (badges.length === 0) return null;
  const have = new Set(badges.map((b) => b.badge));
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Badges">
      {BADGE_ORDER.filter((code) => have.has(code)).map((code) => (
        <span
          key={code}
          title={BADGES[code]!.how}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium"
        >
          <span aria-hidden>{BADGES[code]!.emoji}</span> {BADGES[code]!.label}
        </span>
      ))}
    </div>
  );
}

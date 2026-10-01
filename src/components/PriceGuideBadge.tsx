import { BadgeCheck, Scale, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/marketplace";
import type { PriceGuide } from "@/lib/marketDeals";

const TONES = {
  good: { className: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400", Icon: BadgeCheck },
  fair: { className: "bg-sky-600/10 text-sky-700 dark:text-sky-400", Icon: Scale },
  high: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400", Icon: TrendingUp },
} as const;

/** RevMate's price guide: how the price compares with similar cars listed here. */
export function PriceGuideBadge({
  guide,
  compact = false,
}: {
  guide: PriceGuide;
  compact?: boolean;
}) {
  const { className, Icon } = TONES[guide.tone];
  if (compact) {
    return (
      <span
        className={`mt-0.5 inline-flex w-fit items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${className}`}
      >
        <Icon className="size-3" /> {guide.label}
      </span>
    );
  }
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-bold">{guide.label}</p>
        <p className="text-xs opacity-90">
          Similar cars on RevMate are typically around {formatPrice(guide.typical)} (compared with{" "}
          {guide.compared} listed now). A guide only — condition, history and spec matter too.
        </p>
      </div>
    </div>
  );
}

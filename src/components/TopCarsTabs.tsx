import { Link } from "@tanstack/react-router";
import { Swords, Trophy } from "lucide-react";
import { BATTLES_ENABLED } from "@/lib/features";

const TABS = [
  ...(BATTLES_ENABLED
    ? [{ to: "/battles" as const, label: "Battles", icon: Swords }]
    : []),
  { to: "/leaderboard", label: "Rankings", icon: Trophy },
] as const;

/** Top cars: all-time Rankings, plus head-to-head Battles while enabled. */
export function TopCarsTabs({ active }: { active: "/battles" | "/leaderboard" }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Top cars</h1>
      <nav aria-label="Top cars" className={`mt-3 grid rounded-2xl bg-muted p-1 ${BATTLES_ENABLED ? "grid-cols-2" : "grid-cols-1"}`}>
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-current={active === to ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
              active === to
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

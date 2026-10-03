import { Link } from "@tanstack/react-router";
import { Swords, Trophy } from "lucide-react";

const TABS = [
  { to: "/battles", label: "Battles", icon: Swords },
  { to: "/leaderboard", label: "Rankings", icon: Trophy },
] as const;

/** Top cars is one section: head-to-head Battles and the all-time Rankings. */
export function TopCarsTabs({ active }: { active: "/battles" | "/leaderboard" }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Top cars</h1>
      <nav aria-label="Top cars" className="mt-3 grid grid-cols-2 rounded-2xl bg-muted p-1">
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

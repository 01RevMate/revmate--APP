import { Link } from "@tanstack/react-router";
import { ChevronRight, HeartHandshake, Zap } from "lucide-react";

/** The standout entry point for the community home-charger network. */
export function CommunityChargerCard({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  if (compact)
    return (
      <Link
        to="/ev-chargers/community"
        className={`flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 active:scale-[0.99] ${className}`}
      >
        <img src="/community-charger-logo.jpg" alt="" width={1088} height={1088} loading="lazy" className="size-10 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Community chargers</span>
          <span className="block truncate text-xs text-muted-foreground">Know an EV driver? Members lend home chargers in emergencies</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  return (
    <Link
      to="/ev-chargers/community"
      className={`group relative block overflow-hidden rounded-3xl bg-foreground p-4 text-background shadow-lg active:scale-[0.99] ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <img
          src="/community-charger-logo.jpg"
          alt="Community Charger logo"
          width={1088}
          height={1088}
          loading="lazy"
          className="size-20 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            <Zap className="size-3" /> Community chargers
          </p>
          <p className="mt-0.5 text-lg font-extrabold leading-tight">Low on range? We've got you.</p>
          <p className="mt-1 text-xs text-background/70">
            Find an EV owner nearby who'll lend their home charger in an emergency, or offer yours.
          </p>
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
        <span className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
          <Zap className="size-4" /> I need a charge
        </span>
        <span className="flex items-center justify-center gap-1.5 rounded-xl bg-background/10 px-3 py-2">
          <HeartHandshake className="size-4" /> Offer mine <ChevronRight className="size-4 opacity-60" />
        </span>
      </div>
    </Link>
  );
}

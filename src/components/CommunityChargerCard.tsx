import { Link } from "@tanstack/react-router";
import { ChevronRight, HeartHandshake, Zap } from "lucide-react";
import { CommunityChargerMark } from "@/components/CommunityChargerMark";
import { useIsChargerHost } from "@/lib/communityChargers";

/** The standout entry point for the community home-charger network. */
export function CommunityChargerCard({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const isHost = useIsChargerHost();
  if (compact)
    return (
      <Link
        to="/ev-chargers/community"
        search={{ tab: undefined }}
        className={`flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 active:scale-[0.99] ${className}`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <CommunityChargerMark className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Community chargers</span>
          <span className="block truncate text-xs text-muted-foreground">Know an EV driver? Members lend home chargers in emergencies</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-foreground p-4 text-background shadow-lg ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/30 blur-3xl" />
      <Link to="/ev-chargers/community" search={{ tab: undefined }} className="relative flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-background/20 bg-background/5">
          <CommunityChargerMark className="size-10" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            <Zap className="size-3" /> Community chargers
          </p>
          <p className="mt-0.5 text-lg font-extrabold leading-tight">Low on range? We've got you.</p>
          <p className="mt-1 text-xs text-background/70">
            {isHost ? "You're a Community Charger. Thank you for helping drivers near you." : "Find an EV owner nearby who'll lend their home charger in an emergency, or offer yours."}
          </p>
        </div>
      </Link>
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
        <Link to="/ev-chargers/community" search={{ tab: "need" }} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-primary-foreground active:scale-[0.98]">
          <Zap className="size-4" /> {isHost ? "Find a charge" : "I need a charge"}
        </Link>
        <Link to="/ev-chargers/community" search={{ tab: "host" }} className="flex items-center justify-center gap-1.5 rounded-xl bg-background/10 px-3 py-2 active:scale-[0.98]">
          <HeartHandshake className="size-4" /> {isHost ? "My charger" : "Offer mine"} <ChevronRight className="size-4 opacity-60" />
        </Link>
      </div>
    </div>
  );
}

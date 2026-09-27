import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clapperboard, Crown, MapPin, Swords, Trophy } from "lucide-react";
import { fetchActiveChallenge, fetchCarOfTheWeek } from "@/lib/engagement";
import { displayUsernameWithoutAt } from "@/lib/usernames";

/**
 * The strip under the feed filters: quick ways into Battles, Revs and Near
 * you, plus this week's challenge and last week's Car of the Week.
 */
export function FeedHighlights() {
  const { data: champion } = useQuery({
    queryKey: ["car-of-the-week"],
    queryFn: fetchCarOfTheWeek,
    staleTime: 10 * 60_000,
  });
  const { data: challenge } = useQuery({
    queryKey: ["active-challenge"],
    queryFn: fetchActiveChallenge,
    staleTime: 10 * 60_000,
  });
  const car = champion?.garage_cars;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <QuickLink
          to="/battles"
          icon={Swords}
          label="Battles"
          className="from-rose-500 to-orange-500"
        />
        <QuickLink
          to="/revs"
          icon={Clapperboard}
          label="Revs"
          className="from-violet-600 to-fuchsia-500"
        />
        <QuickLink
          to="/near-you"
          icon={MapPin}
          label="Near you"
          className="from-emerald-600 to-teal-500"
        />
      </div>

      {challenge && (
        <Link
          to="/tags/$tag"
          params={{ tag: challenge.tag }}
          className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 hover:bg-amber-500/15"
        >
          <Trophy className="size-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              This week: {challenge.title} <span className="text-amber-700">#{challenge.tag}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {challenge.description || `Post with #${challenge.tag} to enter`}
            </p>
          </div>
        </Link>
      )}

      {champion && car?.profiles && (
        <Link
          to="/u/$username/cars/$carId"
          params={{ username: car.profiles.username, carId: car.id }}
          className="flex items-center gap-3 overflow-hidden rounded-lg border border-yellow-500/40 bg-gradient-to-r from-yellow-500/15 to-transparent p-2 pr-3 hover:from-yellow-500/25"
        >
          {car.photo_url && (
            <img src={car.photo_url} alt="" className="size-14 shrink-0 rounded-md object-cover" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-yellow-700">
              <Crown className="size-3.5" fill="currentColor" /> Car of the Week
            </p>
            <p className="truncate text-sm font-semibold">
              {car.nickname} · {car.make} {car.model}
            </p>
            <p className="text-xs text-muted-foreground">
              {displayUsernameWithoutAt(car.profiles.username)} · {champion.wins} battle wins
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  className,
}: {
  to: "/battles" | "/revs" | "/near-you";
  icon: typeof Swords;
  label: string;
  className: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r px-2 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 ${className}`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

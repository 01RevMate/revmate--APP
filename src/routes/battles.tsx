import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, SkipForward, Swords } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { CarLogo } from "@/components/CarLogo";
import { useEngagementFeaturesStatus } from "@/lib/features";
import { fetchBattle, fetchCarOfTheWeek, voteBattle, type BattleCar } from "@/lib/engagement";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/battles")({
  head: () => ({
    meta: [
      { title: "Car Battles — RevMate" },
      {
        name: "description",
        content: "Two cars, one vote. Pick your favourite and crown Car of the Week.",
      },
      { property: "og:title", content: "Car Battles — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BattlesPage,
});

function BattlesPage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const status = useEngagementFeaturesStatus();
  const [pair, setPair] = useState<BattleCar[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [votes, setVotes] = useState(0);
  const [loading, setLoading] = useState(false);
  // Don't show the same cars again straight away.
  const recent = useRef<string[]>([]);

  const { data: champion } = useQuery({
    queryKey: ["car-of-the-week"],
    queryFn: fetchCarOfTheWeek,
    enabled: status === "on",
  });

  async function loadNext() {
    setLoading(true);
    setPicked(null);
    try {
      let next = await fetchBattle(recent.current.slice(-40));
      // Ran out of fresh cars — start over rather than show nothing.
      if (next.length < 2 && recent.current.length) {
        recent.current = [];
        next = await fetchBattle([]);
      }
      recent.current.push(...next.map((car) => car.id));
      setPair(next.length === 2 ? next : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load the next battle");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "on") void loadNext();
  }, [status]);

  async function pick(winner: BattleCar, loser: BattleCar) {
    if (!user) return openAuthModal("Create a free account to vote in Car Battles.");
    if (picked) return;
    setPicked(winner.id);
    try {
      await voteBattle(winner.id, loser.id);
      setVotes((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["profile-level"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your vote");
    }
    // A beat to see the winner light up, then straight into the next pair.
    window.setTimeout(() => void loadNext(), 450);
  }

  if (status !== "on") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <Swords className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {status === "checking" ? "Loading…" : "Car Battles are coming soon"}
        </h1>
      </main>
    );
  }

  const car = champion?.garage_cars;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Swords className="size-6 text-rose-500" /> Car Battles
          </h1>
          <p className="text-sm text-muted-foreground">Tap the one you'd rather have.</p>
        </div>
        {votes > 0 && (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums">
            {votes} {votes === 1 ? "vote" : "votes"}
          </span>
        )}
      </header>

      {pair && pair.length === 2 ? (
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:gap-4">
          {pair.map((car, index) => (
            <BattleCard
              key={car.id}
              car={car}
              state={!picked ? "idle" : picked === car.id ? "won" : "lost"}
              onPick={() => void pick(car, pair[1 - index]!)}
            />
          ))}
          <span className="pointer-events-none absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-foreground text-sm font-black text-background">
            VS
          </span>
        </div>
      ) : (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          {loading ? (
            <Loader2 className="mx-auto size-6 animate-spin" />
          ) : (
            "Not enough cars with photos for a battle yet — add a photo to your car to join in!"
          )}
        </div>
      )}

      {pair && pair.length === 2 && (
        <button
          type="button"
          onClick={() => void loadNext()}
          disabled={loading}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <SkipForward className="size-4" /> Can't decide — skip
        </button>
      )}

      <section className="mt-8 rounded-lg border border-border p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-yellow-700">
          <Crown className="size-4" fill="currentColor" /> Car of the Week
        </h2>
        {car?.profiles ? (
          <Link
            to="/u/$username/cars/$carId"
            params={{ username: car.profiles.username, carId: car.id }}
            className="mt-3 flex items-center gap-3"
          >
            {car.photo_url && (
              <img src={car.photo_url} alt="" className="size-16 rounded-md object-cover" />
            )}
            <div>
              <p className="font-semibold">{car.nickname}</p>
              <p className="text-sm text-muted-foreground">
                {car.make} {car.model} · {displayUsernameWithoutAt(car.profiles.username)} ·{" "}
                {champion?.wins} wins
              </p>
            </div>
          </Link>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            The car with the most battle wins each week (Monday to Sunday) is crowned here.
          </p>
        )}
      </section>
    </main>
  );
}

function BattleCard({
  car,
  state,
  onPick,
}: {
  car: BattleCar;
  state: "idle" | "won" | "lost";
  onPick: () => void;
}) {
  const total = car.battle_wins + car.battle_losses;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={state !== "idle"}
      className={`group overflow-hidden rounded-xl border-2 bg-card text-left transition-all duration-300 ${state === "won" ? "scale-[1.02] border-emerald-500 shadow-lg" : state === "lost" ? "border-border opacity-50" : "border-border hover:border-foreground/40 active:scale-[0.98]"}`}
    >
      <div className="relative aspect-[3/4] bg-muted sm:aspect-[4/3]">
        <img src={car.photo_url} alt={car.nickname} className="size-full object-cover" />
        {state === "won" && (
          <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 text-4xl">
            🏆
          </span>
        )}
      </div>
      <div className="p-2 sm:p-3">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <CarLogo make={car.make} className="size-4 shrink-0" />
          {car.nickname}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {car.year ? `${car.year} ` : ""}
          {car.make} {car.model}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {displayUsernameWithoutAt(car.username)}
          {total > 0 && ` · ${Math.round((car.battle_wins / total) * 100)}% wins`}
        </p>
      </div>
    </button>
  );
}

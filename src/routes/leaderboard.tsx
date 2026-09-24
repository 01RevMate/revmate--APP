import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, ThumbsDown, Trophy } from "lucide-react";
import { CarLogo } from "@/components/CarLogo";
import { GarageCarTile } from "@/components/GarageCarTile";
import {
  fetchGarageCarBrandLeaderboard,
  fetchGarageCarLeaderboard,
  fetchGarageCarModelLeaderboard,
  type GarageCar,
} from "@/lib/garage";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — RevMate" },
      {
        name: "description",
        content: "The highest-ranked brands, models and individual cars on RevMate.",
      },
      { property: "og:title", content: "Leaderboard — RevMate" },
      {
        property: "og:description",
        content: "The highest-ranked brands, models and individual cars on RevMate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

type Tab = "brands" | "models" | "cars";

function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("brands");
  const [filterMake, setFilterMake] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ranked by net score — likes minus dislikes.
      </p>

      <div className="mt-6 flex gap-2 border-b border-border">
        {(
          [
            ["brands", "Top Brands"],
            ["models", "Top Models"],
            ["cars", "Top Cars"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              if (id !== "models") setFilterMake(null);
            }}
            className={`px-3 py-2 text-sm font-medium ${tab === id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "brands" && (
        <BrandsTab
          onSelectBrand={(make) => {
            setFilterMake(make);
            setTab("models");
          }}
        />
      )}
      {tab === "models" && <ModelsTab filterMake={filterMake} onClearFilter={() => setFilterMake(null)} />}
      {tab === "cars" && <CarsTab />}
    </div>
  );
}

function BrandsTab({ onSelectBrand }: { onSelectBrand: (make: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "brands"],
    queryFn: () => fetchGarageCarBrandLeaderboard(),
  });
  if (isLoading) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">No ranked cars yet.</p>;
  return (
    <ul className="mt-6 space-y-2">
      {data.map((entry) => (
        <li key={entry.make}>
          <button
            onClick={() => onSelectBrand(entry.make)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-accent"
          >
            <RankBadge rank={entry.rank} />
            <CarLogo make={entry.make} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{entry.make}</p>
              <p className="text-xs text-muted-foreground">{entry.car_count} cars</p>
            </div>
            <ReactionCounts likes={entry.total_likes} dislikes={entry.total_dislikes} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ModelsTab({
  filterMake,
  onClearFilter,
}: {
  filterMake: string | null;
  onClearFilter: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "models", filterMake],
    queryFn: () => fetchGarageCarModelLeaderboard(filterMake ?? undefined),
  });
  return (
    <div>
      {filterMake && (
        <button onClick={onClearFilter} className="mt-4 text-xs text-primary underline">
          Showing {filterMake} only — clear filter
        </button>
      )}
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <p className="mt-6 text-sm text-muted-foreground">No ranked cars yet.</p>
      )}
      <ul className="mt-4 space-y-2">
        {data?.map((entry) => (
          <li
            key={`${entry.make}-${entry.model}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <RankBadge rank={entry.rank} />
            <CarLogo make={entry.make} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {entry.make} {entry.model}
              </p>
              <p className="text-xs text-muted-foreground">{entry.car_count} cars</p>
            </div>
            <ReactionCounts likes={entry.total_likes} dislikes={entry.total_dislikes} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CarsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "cars"],
    queryFn: () => fetchGarageCarLeaderboard(),
  });
  if (isLoading) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">No ranked cars yet.</p>;
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {data.map((entry) => (
        <GarageCarTile
          key={entry.id}
          username={entry.username}
          rank={entry.rank}
          car={
            {
              id: entry.id,
              nickname: entry.nickname,
              make: entry.make,
              model: entry.model,
              photo_url: entry.photo_url,
              ownership_status: "current",
            } as unknown as GarageCar
          }
        />
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
      {rank <= 3 ? <Trophy className={`size-4 ${rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-400" : "text-amber-700"}`} /> : `#${rank}`}
    </span>
  );
}

function ReactionCounts({ likes, dislikes }: { likes: number; dislikes: number }) {
  return (
    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Heart className="size-3.5" />
        {likes}
      </span>
      <span className="flex items-center gap-1">
        <ThumbsDown className="size-3.5" />
        {dislikes}
      </span>
    </div>
  );
}

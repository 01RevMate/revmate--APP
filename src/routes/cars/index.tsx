import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { carLabel, carPath, fetchCars, yearRange } from "@/lib/cars";
import { Skeleton } from "@/components/ui/skeleton";
import { CarLogo } from "@/components/CarLogo";

type CarsSearch = { q?: string | undefined };

export const Route = createFileRoute("/cars/")({
  validateSearch: (search: Record<string, unknown>): CarsSearch => {
    const raw = search["q"];
    return typeof raw === "string" && raw ? { q: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "Browse cars — RevMate" },
      {
        name: "description",
        content: "Browse and search every car generation covered on RevMate.",
      },
      { property: "og:title", content: "Browse cars — RevMate" },
      {
        property: "og:description",
        content: "Browse and search every car generation covered on RevMate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrowseCars,
});

function BrowseCars() {
  const { q } = Route.useSearch();
  const [term, setTerm] = useState(q ?? "");
  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars", term],
    queryFn: () => fetchCars(term),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Browse cars</h1>
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Filter by make, model or generation"
        className="mt-4 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {!isLoading && cars?.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No cars found.</p>
      )}

      {isLoading && (
        <div className="mt-6 divide-y divide-border rounded-lg border border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && cars && cars.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {cars.map((car) => (
            <li key={car.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <CarLogo make={car.make} className="size-8" />
                <div>
                  <Link {...carPath(car)} className="font-medium hover:underline">
                    {carLabel(car)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {yearRange(car)} · {car.body_type ?? "—"}
                  </p>
                </div>
              </div>
              {car.status === "unverified" && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  Unverified
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

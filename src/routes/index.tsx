import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { carLabel, carPath, fetchCars, yearRange } from "@/lib/cars";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevMate — Research, discuss and trade UK cars" },
      {
        name: "description",
        content:
          "RevMate gives every UK car model and generation one page: specs, common faults, MOT data, parts, discussion and listings.",
      },
      { property: "og:title", content: "RevMate — Research, discuss and trade UK cars" },
      {
        property: "og:description",
        content:
          "Specs, common faults, MOT data, discussion and listings for every UK car generation.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const { data: featured } = useQuery({
    queryKey: ["cars", "featured"],
    queryFn: () => fetchCars(),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Find your car.</h1>
        <p className="mt-3 text-muted-foreground">
          RevMate is the UK's place to research, discuss and trade anything car-related. Every model
          and generation gets one page: specs, common faults, MOT data, parts, a discussion group and
          live listings.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/cars", search: term ? { q: term } : {} });
          }}
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a make or model, e.g. Golf GTI"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Featured car pages</h2>
          <Link to="/cars" className="text-sm text-muted-foreground hover:text-foreground">
            Browse all
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {featured?.slice(0, 6).map((car) => (
            <li key={car.id} className="rounded-lg border border-border p-4">
              <Link {...carPath(car)} className="font-medium hover:underline">
                {carLabel(car)}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {yearRange(car)} · {car.body_type ?? "—"}
              </p>
              {car.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{car.summary}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

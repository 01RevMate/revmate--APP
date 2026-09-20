import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { carLabel, engineOptions, fetchCarBySlug, yearRange } from "@/lib/cars";

export const Route = createFileRoute("/cars/$make/$model/$generation")({
  head: ({ params }) => {
    const pretty = [params.make, params.model, params.generation]
      .map((p) => p.replace(/-/g, " "))
      .join(" ");
    const title = `${pretty} — specs, faults & listings | RevMate`;
    const description = `Specs, common faults, owner Q&A and listings for the ${pretty}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CarPage,
});

function CarPage() {
  const { make, model, generation } = Route.useParams();

  const carQuery = useQuery({
    queryKey: ["car", make, model, generation],
    queryFn: () => fetchCarBySlug(make, model, generation),
  });
  const car = carQuery.data;

  const faults = useQuery({
    queryKey: ["faults", car?.id],
    enabled: !!car,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("car_faults")
        .select("*")
        .eq("car_id", car!.id)
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const questions = useQuery({
    queryKey: ["questions", car?.id],
    enabled: !!car,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*, answers(id, body, created_at)")
        .eq("car_id", car!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const listings = useQuery({
    queryKey: ["listings", car?.id],
    enabled: !!car,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("car_id", car!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (carQuery.isLoading) {
    return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!car) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold">Car page not found</h1>
        <Link to="/cars" className="mt-2 inline-block text-sm text-muted-foreground underline">
          Browse all cars
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{carLabel(car)}</h1>
        {car.status === "unverified" && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Unverified
          </span>
        )}
      </div>
      {car.summary && <p className="mt-2 max-w-2xl text-muted-foreground">{car.summary}</p>}

      <Section title="Specs">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Years" value={yearRange(car)} />
          <Row label="Body type" value={car.body_type ?? "—"} />
        </dl>
        <h3 className="mt-4 text-sm font-medium">Engine options</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {engineOptions(car).map((engine, i) => (
            <li key={i}>
              {engine.name} · {engine.power_bhp ?? "?"} bhp · {engine.fuel} · {engine.gearbox}
            </li>
          ))}
          {engineOptions(car).length === 0 && <li>No engine data yet.</li>}
        </ul>
      </Section>

      <Section title="Common faults">
        <ul className="space-y-3">
          {faults.data?.map((fault) => (
            <li key={fault.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{fault.title}</p>
                <span className="text-xs text-muted-foreground">
                  {fault.typical_cost_low != null && fault.typical_cost_high != null
                    ? `£${fault.typical_cost_low}–£${fault.typical_cost_high}`
                    : "Cost unknown"}{" "}
                  · {fault.source === "ai" ? "AI-sourced" : "Owner-reported"}
                </span>
              </div>
              {fault.description && (
                <p className="mt-1 text-sm text-muted-foreground">{fault.description}</p>
              )}
            </li>
          ))}
          {faults.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No faults logged yet.</li>
          )}
        </ul>
      </Section>

      <Section title="MOT data">
        <p className="text-sm text-muted-foreground">
          MOT pass rates and top failure points will appear here once the DVSA data feed is
          connected.
        </p>
      </Section>

      <Section title="Parts">
        <p className="text-sm text-muted-foreground">
          Parts catalogue placeholder — parts listings for this generation will appear here.
        </p>
      </Section>

      <Section title="Discussion & Q&A">
        <Link to="/ask" className="text-sm underline">
          Ask a question about this car
        </Link>
        <ul className="mt-4 space-y-3">
          {questions.data?.map((question) => (
            <li key={question.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{question.title}</p>
              {question.body && (
                <p className="mt-1 text-sm text-muted-foreground">{question.body}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {question.answers.length} answer{question.answers.length === 1 ? "" : "s"}
              </p>
            </li>
          ))}
          {questions.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No questions yet — be the first.</li>
          )}
        </ul>
      </Section>

      <Section title="Listings">
        <Link to="/sell" className="text-sm underline">
          List a car or part
        </Link>
        <ul className="mt-4 space-y-3">
          {listings.data?.map((listing) => (
            <li key={listing.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{listing.title}</p>
                <span className="text-sm text-muted-foreground">
                  {listing.price != null ? `£${listing.price}` : "POA"} · {listing.type}
                </span>
              </div>
              {listing.description && (
                <p className="mt-1 text-sm text-muted-foreground">{listing.description}</p>
              )}
            </li>
          ))}
          {listings.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No listings for this car yet.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

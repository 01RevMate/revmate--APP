import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useAuth } from "@/hooks/useAuth";
import { carLabel, carPath, type Car } from "@/lib/cars";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Buy & Sell — RevMate" },
      { name: "description", content: "Cars and parts for sale from the RevMate community." },
      { property: "og:title", content: "Buy & Sell — RevMate" },
      { property: "og:description", content: "Cars and parts for sale from the RevMate community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplacePage,
});

type ListingWithCar = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  type: "car" | "part";
  status: string;
  created_at: string;
  cars: Pick<Car, "make" | "model" | "generation"> | null;
};

function MarketplacePage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async (): Promise<ListingWithCar[]> => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, cars(make, model, generation)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ListingWithCar[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Buy & Sell</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cars and parts listed by the community.</p>
        </div>
        {user ? (
          <Link
            to="/sell"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + List something
          </Link>
        ) : (
          <button
            onClick={() => openAuthModal("Create a free account to list a car or part.")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + List something
          </button>
        )}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading listings…</p>}
      {!isLoading && listings?.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No listings yet — be the first to list a car or part.
        </div>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {listings?.map((listing) => (
          <li key={listing.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{listing.title}</p>
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                {listing.type === "car" ? "Whole car" : "Part"}
              </span>
            </div>
            {listing.cars && (
              <Link {...carPath(listing.cars)} className="mt-1 block text-xs text-muted-foreground hover:underline">
                {carLabel(listing.cars)}
              </Link>
            )}
            {listing.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{listing.description}</p>
            )}
            <p className="mt-2 text-sm font-semibold">
              {listing.price != null ? `£${listing.price}` : "POA"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

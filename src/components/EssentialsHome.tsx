import { useQuery } from "@tanstack/react-query";
import { EssentialsCarCare } from "@/components/EssentialsCarCare";
import { useCarCareFeature } from "@/lib/carCare";
import { Link } from "@tanstack/react-router";
import {
  BadgePoundSterling,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Car,
  Calculator,
  Fuel,
  MessageCircleQuestion,
  PlugZap,
  Puzzle,
  Warehouse,
  type LucideIcon,
  Stethoscope,
  Store,
} from "lucide-react";
import { useSocialFeatures } from "@/lib/features";
import { fetchActiveListings } from "@/lib/listings";

type Tile = {
  label: string;
  hint: string;
  icon: LucideIcon;
  colour: string;
  link:
    | { to: "/marketplace"; search: { type?: "car" | "part" } }
    | { to: "/sell" | "/ask" | "/cars" | "/garage" | "/meets" | "/issues" | "/businesses" };
};

// Planned tools, shown honestly as "coming soon" so the space is ready for
// them — nothing here pretends to work yet.
const COMING_SOON: { label: string; hint: string; icon: LucideIcon }[] = [
  { label: "Cheapest fuel near you", hint: "Live petrol and diesel prices", icon: Fuel },
  { label: "EV chargers near you", hint: "Find a free charger nearby", icon: PlugZap },
  { label: "MOT & tax reminders", hint: "Never miss a renewal", icon: CalendarCheck },
  { label: "Running cost calculator", hint: "What your car really costs", icon: Calculator },
];

/**
 * The practical side of RevMate for people who aren't here for the car
 * community: buying and selling, parts, fault help and research — and the
 * home for fuel prices and EV chargers when they arrive.
 */
export function EssentialsHome() {
  const social = useSocialFeatures();
  const careOn = useCarCareFeature();
  const comingSoon = COMING_SOON.filter((item) => !careOn || !item.label.startsWith("MOT"));
  const { data: listings } = useQuery({ queryKey: ["listings"], queryFn: fetchActiveListings });
  const latest = (listings ?? []).slice(0, 6);

  const tiles: Tile[] = [
    {
      label: "Problems & fixes",
      hint: "Faults other owners fixed",
      icon: Stethoscope,
      colour: "bg-rose-600",
      link: { to: "/issues" },
    },
    {
      label: "Local businesses",
      hint: "Mechanics, bodywork, EV & more",
      icon: Store,
      colour: "bg-teal-600",
      link: { to: "/businesses" },
    },
    {
      label: "Buy a car",
      hint: "Cars for sale",
      icon: Car,
      colour: "bg-blue-600",
      link: { to: "/marketplace", search: { type: "car" } },
    },
    {
      label: "Buy parts",
      hint: "Parts & accessories",
      icon: Puzzle,
      colour: "bg-orange-600",
      link: { to: "/marketplace", search: { type: "part" } },
    },
    {
      label: "Sell",
      hint: "List a car or part",
      icon: BadgePoundSterling,
      colour: "bg-emerald-600",
      link: { to: "/sell" },
    },
    {
      label: "Ask for help",
      hint: "Faults, fixes & advice",
      icon: MessageCircleQuestion,
      colour: "bg-rose-600",
      link: { to: "/ask" },
    },
    {
      label: "Research a car",
      hint: "Specs & common faults",
      icon: BookOpen,
      colour: "bg-slate-700",
      link: { to: "/cars" },
    },
    {
      label: "My garage",
      hint: "Your cars in one place",
      icon: Warehouse,
      colour: "bg-violet-600",
      link: { to: "/garage" },
    },
  ];
  if (social) {
    tiles.push({
      label: "Car meets",
      hint: "Events near you",
      icon: CalendarDays,
      colour: "bg-teal-600",
      link: { to: "/meets" },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Essentials</h1>
        <p className="text-sm text-muted-foreground">
          Everything practical for your car, in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            {...tile.link}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
          >
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white ${tile.colour}`}
            >
              <tile.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{tile.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{tile.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {careOn && <EssentialsCarCare />}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Latest for sale</h2>
          <Link to="/marketplace" className="text-sm text-primary">
            See all
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nothing listed yet.
          </p>
        ) : (
          <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {latest.map((listing) => (
              <Link
                key={listing.id}
                to="/marketplace/$listingId"
                params={{ listingId: listing.id }}
                className="w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="aspect-[4/3] bg-muted">
                  {listing.photos?.[0] && (
                    <img src={listing.photos[0]} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{listing.title}</p>
                  <p className="text-sm font-semibold">
                    {listing.price != null ? `£${listing.price.toLocaleString("en-GB")}` : "POA"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {listing.type === "car" ? "Car" : "Part"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Coming soon</h2>
        <div className="grid grid-cols-2 gap-2">
          {comingSoon.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 opacity-80"
            >
              <item.icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

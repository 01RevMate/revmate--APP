import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BadgePoundSterling,
  BookOpen,
  CalendarDays,
  Calculator,
  Car,
  ChevronRight,
  Fuel,
  MessageCircleQuestion,
  Plus,
  PlugZap,
  Puzzle,
  Stethoscope,
  Store,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { useSocialFeatures } from "@/lib/features";
import { fetchActiveListings } from "@/lib/listings";
import { fetchGarage } from "@/lib/garage";
import { daysUntil, dueState, useCarCareFeature, type DueState } from "@/lib/carCare";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import { formatPrice } from "@/lib/marketplace";

// Essentials: the practical, just-for-me side of RevMate, styled like an
// iOS app — grey background, white rounded cards, big tap targets and
// Settings-style grouped lists. Nothing social on this page.

type LinkTarget =
  | { to: "/marketplace"; search: { type?: "car" | "part" } }
  | {
      to:
        | "/sell"
        | "/ask"
        | "/cars"
        | "/garage"
        | "/meets"
        | "/issues"
        | "/businesses"
        | "/ev-chargers"
        | "/fuel-prices";
    };

/** An iOS-style app icon: white glyph on a coloured rounded square. */
function AppIcon({
  icon: Icon,
  colour,
  size = "md",
}: {
  icon: LucideIcon;
  colour: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-white ${colour} ${size === "lg" ? "size-12 rounded-[14px]" : "size-8 rounded-[9px]"}`}
    >
      <Icon className={size === "lg" ? "size-6" : "size-[18px]"} strokeWidth={2.2} />
    </span>
  );
}

const DUE_COLOUR: Record<DueState, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  soon: "text-amber-600 dark:text-amber-400",
  urgent: "text-orange-600 dark:text-orange-400",
  overdue: "text-red-600 dark:text-red-400",
};

/** "16 days" / "Today" / "3 days late" in big type for the car cards. */
function DueBlock({ label, date }: { label: string; date: string | null }) {
  if (!date) {
    return (
      <div className="flex-1 rounded-2xl bg-white/12 px-3 py-2 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
        <p className="text-sm font-semibold text-white">Add date</p>
      </div>
    );
  }
  const days = daysUntil(date);
  const state = dueState(date);
  return (
    <div className="flex-1 rounded-2xl bg-white px-3 py-2 dark:bg-neutral-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-lg font-bold leading-tight ${DUE_COLOUR[state]}`}>
        {days === 0 ? "Today" : days < 0 ? `${-days}d late` : `${days} days`}
      </p>
    </div>
  );
}

function MyCars() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const careOn = useCarCareFeature();
  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const cars = (garage ?? []).filter((car) => car.ownership_status !== "previous");

  if (!user || cars.length === 0) {
    return (
      <Link
        to="/garage"
        onClick={(e) => {
          if (!user) {
            e.preventDefault();
            openAuthModal("Create a free account to add your car and get MOT and tax reminders.");
          }
        }}
        className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950 p-5 dark:from-neutral-700 dark:to-neutral-900 text-white shadow-sm"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <Plus className="size-6" />
        </span>
        <span>
          <span className="block text-lg font-bold">Add your car</span>
          <span className="block text-sm text-white/75">
            MOT and tax countdowns, reminders and fixes for your model
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
      {cars.map((car) => (
        <Link
          key={car.id}
          to="/u/$username/cars/$carId"
          params={{ username: displayUsernameWithoutAt(profile?.username), carId: car.id }}
          className={`relative flex h-44 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl bg-slate-900 p-4 text-white shadow-sm ${cars.length === 1 ? "w-full" : "w-[85%] sm:w-80"}`}
        >
          {car.photo_url && (
            <img src={car.photo_url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <span className="relative">
            <span className="block text-lg font-bold leading-tight drop-shadow">
              {car.nickname || `${car.make} ${car.model}`}
            </span>
            <span className="block text-sm text-white/80 drop-shadow">
              {[car.year, car.make, car.model].filter(Boolean).join(" ")}
            </span>
          </span>
          {careOn ? (
            <span className="relative flex gap-2">
              <DueBlock label="MOT" date={car.mot_due} />
              <DueBlock label="Tax" date={car.tax_due} />
            </span>
          ) : (
            <span className="relative text-sm font-medium text-white/80">Open your car →</span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** A big square widget-style tile for the tools people use most. */
function ToolTile({
  title,
  hint,
  icon,
  colour,
  link,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  colour: string;
  link: LinkTarget;
}) {
  return (
    <Link
      {...link}
      className="flex min-h-32 flex-col justify-between rounded-3xl bg-card p-4 shadow-sm transition-transform active:scale-[0.98]"
    >
      <AppIcon icon={icon} colour={colour} size="lg" />
      <span>
        <span className="block text-base font-bold leading-tight">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

type Row = {
  title: string;
  hint?: string;
  icon: LucideIcon;
  colour: string;
  link?: LinkTarget;
  soon?: boolean;
};

/** An iOS Settings-style inset grouped list. */
function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-sm">
        {rows.map((row, i) => {
          const body = (
            <>
              <AppIcon icon={row.icon} colour={row.colour} />
              <span
                className={`flex min-h-[52px] flex-1 items-center gap-2 py-2 pr-3 ${i > 0 ? "border-t border-border/70" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{row.title}</span>
                  {row.hint && (
                    <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>
                  )}
                </span>
                {row.soon ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Soon
                  </span>
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground/60" />
                )}
              </span>
            </>
          );
          return (
            <li key={row.title}>
              {row.link && !row.soon ? (
                <Link {...row.link} className="flex items-center gap-3 pl-3 active:bg-accent">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 pl-3 opacity-70">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function EssentialsHome() {
  const social = useSocialFeatures();
  const { data: listings } = useQuery({ queryKey: ["listings"], queryFn: fetchActiveListings });
  const latest = (listings ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h1 className="text-3xl font-bold tracking-tight">Essentials</h1>
        <p className="text-sm text-muted-foreground">Everything practical for your car.</p>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 text-lg font-bold">My cars</h2>
        <MyCars />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <ToolTile
          title="Fix a problem"
          hint="Faults other owners fixed"
          icon={Stethoscope}
          colour="bg-[#ff3b30]"
          link={{ to: "/issues" }}
        />
        <ToolTile
          title="Find a mechanic"
          hint="Garages, bodywork, EV & more"
          icon={Store}
          colour="bg-[#34c759]"
          link={{ to: "/businesses" }}
        />
        <ToolTile
          title="Sell"
          hint="List a car or part"
          icon={BadgePoundSterling}
          colour="bg-[#007aff]"
          link={{ to: "/sell" }}
        />
        <ToolTile
          title="Ask for help"
          hint="Get advice from owners"
          icon={MessageCircleQuestion}
          colour="bg-[#ff9500]"
          link={{ to: "/ask" }}
        />
      </section>

      <Group
        title="Buy"
        rows={[
          {
            title: "Cars for sale",
            icon: Car,
            colour: "bg-[#007aff]",
            link: { to: "/marketplace", search: { type: "car" } },
          },
          {
            title: "Parts & accessories",
            icon: Puzzle,
            colour: "bg-[#ff9500]",
            link: { to: "/marketplace", search: { type: "part" } },
          },
        ]}
      />

      <Group
        title="Your car"
        rows={[
          {
            title: "My garage",
            hint: "Your cars, MOT & tax dates",
            icon: Warehouse,
            colour: "bg-[#af52de]",
            link: { to: "/garage" },
          },
          {
            title: "Research a car",
            hint: "Specs and common faults",
            icon: BookOpen,
            colour: "bg-[#5856d6]",
            link: { to: "/cars" },
          },
          ...(social
            ? [
                {
                  title: "Car meets",
                  hint: "Events near you",
                  icon: CalendarDays,
                  colour: "bg-[#30b0c7]",
                  link: { to: "/meets" } as LinkTarget,
                },
              ]
            : []),
        ]}
      />

      {latest.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold">Latest for sale</h2>
            <Link to="/marketplace" className="text-sm font-medium text-[#007aff]">
              See all
            </Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
            {latest.map((listing) => (
              <Link
                key={listing.id}
                to="/marketplace/$listingId"
                params={{ listingId: listing.id }}
                className="w-40 shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm"
              >
                <div className="aspect-[4/3] bg-muted">
                  {listing.photos?.[0] && (
                    <img
                      src={listing.photos[0]}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-bold">{formatPrice(listing.price)}</p>
                  <p className="truncate text-xs text-muted-foreground">{listing.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Group
        title="On the road"
        rows={[
          {
            title: "Cheapest fuel near you",
            hint: "Today's petrol and diesel prices, cheapest first",
            icon: Fuel,
            colour: "bg-[#ff9500]",
            link: { to: "/fuel-prices" },
          },
          {
            title: "EV chargers near you",
            hint: "Map of rapid and fast chargers, plugs and directions",
            icon: PlugZap,
            colour: "bg-[#34c759]",
            link: { to: "/ev-chargers" },
          },
        ]}
      />

      <Group
        title="Coming soon"
        rows={[
          {
            title: "Running cost calculator",
            hint: "What your car really costs",
            icon: Calculator,
            colour: "bg-[#8e8e93]",
            soon: true,
          },
        ]}
      />
    </div>
  );
}

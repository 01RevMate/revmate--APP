import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, GitCompareArrows, Loader2, MapPin, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteSavedSearch,
  describeSearch,
  fetchSavedSearches,
  lookupDistrict,
  saveSearch,
  setSearchAlerts,
  type MarketSearch,
  type PlaceFix,
  type SavedSearch,
  useCompareList,
} from "@/lib/marketDeals";
import { FUEL_LABELS } from "@/lib/vehicleSpecs";

const RADIUS_OPTIONS = ["10", "25", "50", "100"] as const;

/** Pick where you are (postcode district) and how far you'll travel. */
export function DistanceDialog({
  open,
  onOpenChange,
  place,
  radius,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: PlaceFix | null;
  radius: string;
  onChange: (place: PlaceFix | null, radius: string) => void;
}) {
  const [text, setText] = useState(place?.district ?? "");
  const [pickedRadius, setPickedRadius] = useState(radius || "25");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setText(place?.district ?? "");
      setPickedRadius(radius || "25");
    }
  }, [open, place, radius]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      onChange(null, "");
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      const found =
        place && text.trim().toUpperCase() === place.district ? place : await lookupDistrict(text);
      onChange(found, pickedRadius);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find that postcode");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Search near you</DialogTitle>
          <DialogDescription>
            Your postcode stays on this device. We only use the first half to work out distances.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={apply} className="space-y-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Postcode, e.g. LS6 2AB"
            maxLength={8}
            autoComplete="postal-code"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm uppercase placeholder:normal-case"
          />
          <div>
            <p className="mb-1.5 text-sm font-medium">Distance</p>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPickedRadius(r)}
                  className={`rounded-md border py-2 text-sm font-semibold ${pickedRadius === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                >
                  {r} mi
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              Show nearby
            </button>
            {place && (
              <button
                type="button"
                onClick={() => {
                  onChange(null, "");
                  onOpenChange(false);
                }}
                className="rounded-md px-3 text-sm text-muted-foreground hover:bg-accent"
              >
                Anywhere
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Save what's on screen as a search, with new-listing and price-drop alerts. */
export function SaveSearchDialog({
  open,
  onOpenChange,
  userId,
  search,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  search: MarketSearch;
}) {
  const queryClient = useQueryClient();
  const summary = describeSearch(search, { fuel: FUEL_LABELS });
  const [name, setName] = useState(summary);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(summary.slice(0, 60));
  }, [open, summary]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSearch(userId, name, search);
      void queryClient.invalidateQueries({ queryKey: ["saved-searches", userId] });
      toast.success("Search saved — we'll tell you when something new matches");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your search");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm font-medium">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal"
            />
          </label>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Bell className="mt-0.5 size-3.5 shrink-0" />
            You'll get a notification when a new listing matches, or when one drops into your
            budget. Switch alerts off any time.
          </p>
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save search"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SavedSearchesDialog({
  open,
  onOpenChange,
  userId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onApply: (search: SavedSearch) => void;
}) {
  const queryClient = useQueryClient();
  const key = ["saved-searches", userId];
  const { data: searches, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchSavedSearches(userId),
    enabled: open,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved searches</DialogTitle>
          <DialogDescription>Tap one to run it again.</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {searches?.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No saved searches yet. Set up your filters and tap "Save search" to get alerts.
          </p>
        )}
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {searches?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <button
                type="button"
                onClick={() => {
                  onApply(s);
                  onOpenChange(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {describeSearch(s.filters, { fuel: FUEL_LABELS })}
                </span>
              </button>
              <button
                type="button"
                aria-label={s.alerts ? "Turn alerts off" : "Turn alerts on"}
                title={s.alerts ? "Alerts on" : "Alerts off"}
                onClick={async () => {
                  await setSearchAlerts(s.id, !s.alerts).catch((err: Error) =>
                    toast.error(err.message),
                  );
                  refresh();
                }}
                className={`rounded-md p-2 ${s.alerts ? "text-primary" : "text-muted-foreground"} hover:bg-accent`}
              >
                {s.alerts ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              </button>
              <button
                type="button"
                aria-label="Delete saved search"
                onClick={async () => {
                  await deleteSavedSearch(s.id).catch((err: Error) => toast.error(err.message));
                  refresh();
                }}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Floating bar once you've picked cars to compare. */
export function CompareBar() {
  const [ids, setIds] = useCompareList();
  if (ids.length === 0) return null;
  return (
    <>
      {/* Room at the end of the page so the bar never hides the last listings. */}
      <div aria-hidden className="h-20" />
      <div
        className="fixed inset-x-3 z-30 mx-auto flex max-w-md items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4 shadow-lg md:!bottom-6"
        // Sits above the bottom nav, which is taller on iPhones (home bar area).
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
      >
        <GitCompareArrows className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-semibold">
          {ids.length} to compare
          {ids.length < 2 && (
            <span className="font-normal text-muted-foreground"> · add one more</span>
          )}
        </span>
        <button
          type="button"
          aria-label="Clear compare"
          onClick={() => setIds([])}
          className="rounded-full p-2 text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
        <Link
          to="/marketplace/compare"
          className={`rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground ${ids.length < 2 ? "pointer-events-none opacity-50" : ""}`}
        >
          Compare
        </Link>
      </div>
    </>
  );
}

export function NearbyChipLabel({ place, radius }: { place: PlaceFix | null; radius: string }) {
  return (
    <>
      {place ? <MapPin className="size-3.5" /> : <Search className="size-3.5" />}
      {place ? `${radius} mi of ${place.district}` : "Near me"}
    </>
  );
}

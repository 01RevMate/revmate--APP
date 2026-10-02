import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchListingById, MAX_CAR_LISTING_PHOTOS, updateListing } from "@/lib/listings";
import { useMarketplaceFeatures } from "@/lib/marketplace";
import { EMPTY_SPECS, useListingDetailsFeature, type ListingSpecs } from "@/lib/vehicleSpecs";
import {
  EMPTY_PART_DETAILS,
  EMPTY_RUNNING_COSTS,
  listingQuality,
  useMarketUpgradeFeature,
  type PartDetails,
  type PlaceFix,
  type RunningCosts,
} from "@/lib/marketDeals";
import { VehicleSpecsFields } from "@/components/VehicleSpecsFields";
import { ListingPhotosEditor } from "@/components/ListingPhotosEditor";
import {
  ListingQualityMeter,
  LocationField,
  PartDetailsFields,
  RunningCostFields,
} from "@/components/SellExtras";

export const Route = createFileRoute("/marketplace/$listingId_/edit")({
  head: () => ({
    meta: [{ title: "Edit advert — RevMate" }, { name: "robots", content: "noindex" }],
  }),
  component: EditListingPage,
});

const MAX_PART_PHOTOS = 10;
const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function pick<T extends object>(source: Record<string, unknown>, template: T): T {
  return Object.fromEntries(
    Object.keys(template).map((k) => [
      k,
      (source[k] ?? (template as Record<string, unknown>)[k]) as unknown,
    ]),
  ) as T;
}

function EditListingPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const market = useMarketplaceFeatures();
  const detailsOn = useListingDetailsFeature();
  const upgrade = useMarketUpgradeFeature();
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListingById(listingId),
  });

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [area, setArea] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [specs, setSpecs] = useState<ListingSpecs>(EMPTY_SPECS);
  const [costs, setCosts] = useState<RunningCosts>(EMPTY_RUNNING_COSTS);
  const [details, setDetails] = useState<PartDetails>(EMPTY_PART_DETAILS);
  const [place, setPlace] = useState<PlaceFix | null>(null);
  const [openToOffers, setOpenToOffers] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!listing || loaded) return;
    const row = listing as unknown as Record<string, unknown>;
    setTitle(listing.title);
    setHeadline(listing.headline ?? "");
    setDescription(listing.description ?? "");
    setPrice(listing.price != null ? String(Number(listing.price)) : "");
    setMileage(listing.mileage != null ? String(listing.mileage) : "");
    setArea(listing.location_area ?? "");
    setPhotos(listing.photos ?? []);
    setSpecs(pick(row, EMPTY_SPECS));
    setCosts(pick(row, EMPTY_RUNNING_COSTS));
    setDetails(pick(row, EMPTY_PART_DETAILS));
    setOpenToOffers(listing.open_to_offers ?? true);
    if (listing.location_district && listing.location_lat != null && listing.location_lng != null) {
      setPlace({
        district: listing.location_district,
        lat: listing.location_lat,
        lng: listing.location_lng,
        town: listing.location_area,
      });
    }
    setLoaded(true);
  }, [listing, loaded]);

  if (isLoading)
    return <p className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  if (!listing || !user || listing.user_id !== user.id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-xl font-semibold">You can only edit your own adverts</h1>
        <Link to="/marketplace" className="mt-2 inline-block text-sm text-primary underline">
          Back to Buy & Sell
        </Link>
      </div>
    );
  }
  const isCar = listing.type === "car";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!listing || !user) return;
    if (!title.trim()) {
      toast.error("Give your advert a title.");
      return;
    }
    const priceValue =
      price.trim() === "" ? null : Math.round(Number(price.replace(/[£,\s]/g, "")));
    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      toast.error("Enter a price in pounds, or leave it blank for POA.");
      return;
    }
    if (upgrade && !isCar && !details.collection_available && !details.postage_available) {
      toast.error("Choose collection, postage or both.");
      return;
    }
    setSaving(true);
    try {
      await updateListing(listing.id, user.id, {
        title: title.trim().slice(0, 120),
        headline: headline.trim() || null,
        description: description.trim(),
        price: priceValue,
        mileage:
          isCar && mileage.trim() ? Math.round(Number(mileage)) : isCar ? null : listing.mileage,
        photos,
        ...(market ? { location_area: area.trim() || null } : {}),
        ...(isCar && detailsOn ? specs : {}),
        ...(upgrade
          ? {
              ...(isCar ? costs : details),
              open_to_offers: openToOffers,
              location_district: place?.district ?? null,
              location_lat: place?.lat ?? null,
              location_lng: place?.lng ?? null,
            }
          : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listing", listing.id] }),
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
      ]);
      toast.success("Advert updated");
      navigate({ to: "/marketplace/$listingId", params: { listingId: listing.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your changes");
    } finally {
      setSaving(false);
    }
  }

  const quality = listingQuality({
    isCar,
    photos: photos.length,
    description,
    headline,
    specsFilled: isCar
      ? Object.values(specs).filter((v) => v !== null && v !== "").length
      : (details.part_category ? 1 : 0) + (details.item_condition ? 1 : 0),
    motDate: !!specs.mot_expiry,
    serviceHistory: !!specs.service_history,
    location: !!place || !!area.trim(),
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link
        to="/marketplace/$listingId"
        params={{ listingId: listing.id }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to advert
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit advert</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything's optional except the title. The more you add, the higher your advert shows in
        Buy & Sell.
      </p>

      <form onSubmit={save} className="mt-6 space-y-5">
        <ListingQualityMeter {...quality} />

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            className={input}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Headline (optional)</span>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={80}
            placeholder="A short line to grab attention"
            className={input}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Price (£)</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
              placeholder="Blank = POA"
              className={input}
            />
          </label>
          {isCar && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Mileage</span>
              <input
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                inputMode="numeric"
                className={input}
              />
            </label>
          )}
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Lowering the price shows it as a price drop, and watchers get an alert.
        </p>

        <ListingPhotosEditor
          userId={user.id}
          photos={photos}
          onChange={setPhotos}
          max={isCar ? MAX_CAR_LISTING_PHOTOS : MAX_PART_PHOTOS}
        />

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className={input}
          />
        </label>

        {!isCar && upgrade && <PartDetailsFields value={details} onChange={setDetails} />}
        {isCar && detailsOn && <VehicleSpecsFields value={specs} onChange={setSpecs} />}
        {isCar && upgrade && <RunningCostFields value={costs} onChange={setCosts} />}

        {upgrade && (
          <LocationField value={place} onChange={setPlace} onTown={(t) => !area && setArea(t)} />
        )}
        {market && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Area (optional)</span>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={60}
              placeholder="Town or city"
              className={input}
            />
          </label>
        )}
        {upgrade && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={openToOffers}
              onChange={(e) => setOpenToOffers(e.target.checked)}
            />
            Let buyers make offers
          </label>
        )}

        <div className="sticky bottom-20 flex gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur md:bottom-4">
          <button
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </button>
          <Link
            to="/marketplace/$listingId"
            params={{ listingId: listing.id }}
            className="rounded-md px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

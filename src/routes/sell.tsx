import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Loader2, Package, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { CarPicker } from "@/components/CarPicker";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import { fetchCarPhotos } from "@/lib/garage";
import {
  createListing,
  fetchMySellableGarageCars,
  MAX_CAR_LISTING_PHOTOS,
  MIN_CAR_LISTING_PHOTOS,
} from "@/lib/listings";
import { createPost, attachImagesToPost } from "@/lib/posts";
import { uploadImage, validateImageFile } from "@/lib/uploads";

export const Route = createFileRoute("/sell")({
  validateSearch: (search: Record<string, unknown>) => ({
    garageCarId:
      typeof search["garageCarId"] === "string" ? (search["garageCarId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sell a car or part — RevMate" },
      {
        name: "description",
        content: "List a car straight from your garage, or list a part for sale.",
      },
      { property: "og:title", content: "Sell a car or part — RevMate" },
      {
        property: "og:description",
        content: "List a car straight from your garage, or list a part for sale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellPage,
});

const RECOMMENDED_SHOTS = [
  "Front 3/4 angle (most important — this is your cover photo)",
  "Rear 3/4 angle",
  "Both sides, straight on",
  "Interior — dashboard and seats",
  "Odometer / mileage",
  "Engine bay",
  "Any wear, damage or modifications — be honest, it builds trust",
];

function SellPage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"choose" | "car" | "other">("choose");

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sell on RevMate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a free account to list a car from your garage or sell a part.
        </p>
        <button
          onClick={() => openAuthModal("Create a free account to sell on RevMate.")}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign up
        </button>
      </div>
    );
  }

  if (mode === "choose" && !search.garageCarId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Create a listing</h1>
        <p className="mt-1 text-sm text-muted-foreground">What are you selling?</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setMode("car")}
            className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 text-center hover:border-primary hover:bg-accent"
          >
            <Car className="size-8 text-primary" />
            <span className="font-medium">A car from your garage</span>
            <span className="text-xs text-muted-foreground">
              Prefilled from your garage — quickest way to list.
            </span>
          </button>
          <button
            onClick={() => setMode("other")}
            className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 text-center hover:border-primary hover:bg-accent"
          >
            <Package className="size-8 text-primary" />
            <span className="font-medium">Something else</span>
            <span className="text-xs text-muted-foreground">Parts, mods and other items.</span>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "other") {
    return (
      <SellSomethingElseForm
        onBack={() => setMode("choose")}
        userId={user.id}
        navigate={navigate}
      />
    );
  }

  return (
    <SellCarForm
      userId={user.id}
      presetGarageCarId={search.garageCarId}
      onBack={() => setMode("choose")}
      navigate={navigate}
    />
  );
}

function SellCarForm({
  userId,
  presetGarageCarId,
  onBack,
  navigate,
}: {
  userId: string;
  presetGarageCarId: string | undefined;
  onBack: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: cars, isLoading } = useQuery({
    queryKey: ["my-sellable-garage-cars", userId],
    queryFn: () => fetchMySellableGarageCars(userId),
  });
  const [garageCarId, setGarageCarId] = useState(presetGarageCarId ?? "");
  const selectedCar = cars?.find((c) => c.id === garageCarId);

  const { data: existingPhotos } = useQuery({
    queryKey: ["garage-car-photos", garageCarId],
    enabled: !!garageCarId,
    queryFn: () => fetchCarPhotos(garageCarId),
  });

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [showCarStats, setShowCarStats] = useState(true);
  const [pushToFeed, setPushToFeed] = useState(true);
  const [saving, setSaving] = useState(false);

  const allPhotos = useMemo(
    () => [...selectedPhotos, ...uploadedPhotos],
    [selectedPhotos, uploadedPhotos],
  );

  function selectCar(id: string) {
    setGarageCarId(id);
    const car = cars?.find((c) => c.id === id);
    if (car?.mileage != null) setMileage(String(car.mileage));
    setSelectedPhotos(car?.photo_url ? [car.photo_url] : []);
    setUploadedPhotos([]);
  }

  function togglePhoto(url: string) {
    if (!selectedPhotos.includes(url) && allPhotos.length >= MAX_CAR_LISTING_PHOTOS) {
      toast.error(`A listing can have up to ${MAX_CAR_LISTING_PHOTOS} photos.`);
      return;
    }
    setSelectedPhotos((prev) =>
      prev.includes(url) ? prev.filter((p) => p !== url) : [...prev, url],
    );
  }

  async function handleUploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const remainingSlots = MAX_CAR_LISTING_PHOTOS - allPhotos.length;
    if (remainingSlots <= 0) {
      toast.error(`A listing can have up to ${MAX_CAR_LISTING_PHOTOS} photos.`);
      return;
    }

    const validFiles = files.filter((file) => {
      const problem = validateImageFile(file);
      if (problem) toast.error(problem);
      return !problem;
    });
    const filesToUpload = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      toast.error(
        `Only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} can be added. The limit is ${MAX_CAR_LISTING_PHOTOS}.`,
      );
    }
    if (filesToUpload.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of filesToUpload) {
        try {
          uploadedUrls.push(await uploadImage("user-media", userId, file));
        } catch (err) {
          toast.error(
            err instanceof Error ? `${file.name}: ${err.message}` : `Couldn't upload ${file.name}`,
          );
        }
      }
      if (uploadedUrls.length > 0) {
        setUploadedPhotos((prev) => [...prev, ...uploadedUrls]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCar) {
      toast.error("Pick a car from your garage first.");
      return;
    }
    if (!price) {
      toast.error("Set a price.");
      return;
    }
    if (!mileage) {
      toast.error("Confirm the mileage.");
      return;
    }
    if (allPhotos.length < MIN_CAR_LISTING_PHOTOS) {
      toast.error(`Add at least ${MIN_CAR_LISTING_PHOTOS} photos — ${allPhotos.length} so far.`);
      return;
    }
    if (allPhotos.length > MAX_CAR_LISTING_PHOTOS) {
      toast.error(`A listing can have up to ${MAX_CAR_LISTING_PHOTOS} photos.`);
      return;
    }
    setSaving(true);
    try {
      const listingId = await createListing({
        userId,
        carId: selectedCar.car_id ?? null,
        garageCarId: selectedCar.id,
        showCarStats,
        type: "car",
        title: `${selectedCar.make} ${selectedCar.model}${selectedCar.generation ? ` (${selectedCar.generation})` : ""}`,
        description,
        price: Number(price),
        mileage: Number(mileage),
        photos: allPhotos,
        headline: headline.trim() || null,
      });
      if (pushToFeed) {
        const postId = await createPost({
          userId,
          body: description || `${selectedCar.nickname} is up for sale — £${price}`,
          carId: selectedCar.car_id || undefined,
          postedAsGarageCarId: selectedCar.id,
          category: "for_sale",
          listingId,
        });
        await attachImagesToPost(postId, allPhotos.slice(0, 5));
      }
      toast.success("Listing created");
      navigate({ to: "/marketplace" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sell a car from your garage</h1>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading your garage…</p>}
      {!isLoading && cars?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          You don't have any currently-owned cars in your garage yet. Add one on your{" "}
          <Link to="/garage" className="underline">
            garage
          </Link>{" "}
          page first.
        </p>
      )}

      {!garageCarId && cars && cars.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cars.map((car) => (
            <button
              key={car.id}
              onClick={() => selectCar(car.id)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary hover:bg-accent"
            >
              <div className="relative">
                <Avatar photoUrl={car.photo_url} fallback={car.nickname} className="size-14" />
                <CarLogo
                  make={car.make}
                  className="absolute -bottom-1 -right-1 size-5 rounded-full border border-background bg-background"
                />
              </div>
              <span className="text-sm font-medium">{car.nickname}</span>
              <span className="text-xs text-muted-foreground">
                {car.make} {car.model}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedCar && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Avatar
              photoUrl={selectedCar.photo_url}
              fallback={selectedCar.nickname}
              className="size-12"
            />
            <div>
              <p className="font-medium">{selectedCar.nickname}</p>
              <p className="text-xs text-muted-foreground">
                {selectedCar.make} {selectedCar.model}
                {selectedCar.generation ? ` (${selectedCar.generation})` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGarageCarId("")}
              className="ml-auto text-xs text-muted-foreground underline"
            >
              Change car
            </button>
          </div>

          <Field label="Ad headline">
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={80}
              placeholder="e.g. Widebody M4 — turn heads on every drive"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="block text-xs text-muted-foreground">
              A short line to grab attention — shown with the price.
            </span>
          </Field>

          <Field label="Price (£)">
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Confirm mileage">
            <input
              type="number"
              min="0"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Photos ({allPhotos.length}/{MAX_CAR_LISTING_PHOTOS})
            </p>
            <p className="text-xs text-muted-foreground">
              Add at least {MIN_CAR_LISTING_PHOTOS}. You can select several photos at once, up to a
              maximum of
              {` ${MAX_CAR_LISTING_PHOTOS}`}.
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {RECOMMENDED_SHOTS.map((shot) => (
                <li key={shot}>{shot}</li>
              ))}
            </ul>
            {existingPhotos && existingPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {existingPhotos.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => togglePhoto(photo.photo_url)}
                    className={`relative aspect-video overflow-hidden rounded-md ring-2 ${selectedPhotos.includes(photo.photo_url) ? "ring-primary" : "ring-transparent"}`}
                  >
                    <img src={photo.photo_url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {uploadedPhotos.map((url) => (
                  <div key={url} className="group relative aspect-video overflow-hidden rounded-md">
                    <img src={url} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedPhotos((prev) => prev.filter((p) => p !== url))}
                      className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label
              className={`inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium ${uploading || allPhotos.length >= MAX_CAR_LISTING_PHOTOS ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"}`}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading
                ? "Uploading photos…"
                : allPhotos.length >= MAX_CAR_LISTING_PHOTOS
                  ? "15 photo limit reached"
                  : "Add photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleUploadPhotos}
                disabled={uploading || allPhotos.length >= MAX_CAR_LISTING_PHOTOS}
              />
            </label>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Service history, condition, why you're selling, any extras…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCarStats}
              onChange={(e) => setShowCarStats(e.target.checked)}
            />
            Show this car's likes, dislikes, rank and followers on the listing
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pushToFeed}
              onChange={(e) => setPushToFeed(e.target.checked)}
            />
            Also post this to the feed as a "For Sale" card
          </label>

          {allPhotos.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <div className="overflow-hidden rounded-md">
                <img src={allPhotos[0]} alt="" className="aspect-video w-full object-cover" />
              </div>
              {headline && <p className="mt-2 font-semibold">{headline}</p>}
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedCar.year ? `${selectedCar.year} ` : ""}
                {selectedCar.make} {selectedCar.model}
                {selectedCar.generation ? ` (${selectedCar.generation})` : ""}
              </p>
              <p className="text-lg font-bold">
                {price ? `£${Number(price).toLocaleString("en-GB")}` : "POA"}
              </p>
              {mileage && (
                <p className="text-xs text-muted-foreground">
                  {Number(mileage).toLocaleString()} miles
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      )}
    </div>
  );
}

function SellSomethingElseForm({
  onBack,
  userId,
  navigate,
}: {
  onBack: () => void;
  userId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [carId, setCarId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createListing({
        userId,
        carId,
        showCarStats: false,
        type: "part",
        title,
        description,
        price: price ? Number(price) : null,
      });
      toast.success("Listing created");
      navigate({ to: "/marketplace" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </button>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sell a part or other item</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Which car does this fit?">
          <CarPicker value={carId} onChange={setCarId} />
        </Field>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Price (£)">
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <button
          type="submit"
          disabled={saving || !carId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Publishing…" : "Publish listing"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

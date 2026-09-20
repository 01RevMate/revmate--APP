import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Zap, Cog, Fuel, Palette, Plus } from "lucide-react";
import {
  addCarPhoto,
  addMod,
  fetchCarPhotos,
  fetchMods,
  removeCarPhoto,
  removeGarageCar,
  removeMod,
  FUEL_TYPE_LABELS,
  MOD_CATEGORY_LABELS,
  TRANSMISSION_LABELS,
  type GarageCar,
  type GarageMod,
} from "@/lib/garage";
import { createPost } from "@/lib/posts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";

export function GarageCarCard({
  car,
  isOwner,
  onRemoved,
}: {
  car: GarageCar;
  isOwner: boolean;
  onRemoved?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addingMod, setAddingMod] = useState(false);
  const [modTitle, setModTitle] = useState("");
  const [modDescription, setModDescription] = useState("");
  const [modCategory, setModCategory] = useState<NonNullable<GarageMod["category"]>>("other");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState("");

  const { data: mods } = useQuery({
    queryKey: ["garage-mods", car.id],
    queryFn: () => fetchMods(car.id),
  });

  const { data: photos } = useQuery({
    queryKey: ["garage-car-photos", car.id],
    queryFn: () => fetchCarPhotos(car.id),
  });

  function refreshPhotos() {
    queryClient.invalidateQueries({ queryKey: ["garage-car-photos", car.id] });
  }

  async function handleAddPhoto(e: React.FormEvent) {
    e.preventDefault();
    if (!photoUrlInput.trim()) return;
    try {
      await addCarPhoto(car.id, photoUrlInput.trim());
      setPhotoUrlInput("");
      setAddingPhoto(false);
      refreshPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add photo");
    }
  }

  async function handleRemovePhoto(id: string) {
    try {
      await removeCarPhoto(id);
      refreshPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove photo");
    }
  }

  function refreshMods() {
    queryClient.invalidateQueries({ queryKey: ["garage-mods", car.id] });
  }

  async function handleAddMod(e: React.FormEvent) {
    e.preventDefault();
    if (!modTitle.trim()) return;
    if (shareToFeed && !modDescription.trim()) {
      toast.error("Add a description before sharing this mod to the feed.");
      return;
    }
    try {
      await addMod(car.id, modTitle.trim(), modDescription.trim() || undefined, modCategory);
      if (shareToFeed && user) {
        await createPost({
          userId: user.id,
          body: `New mod on ${car.nickname}: ${modTitle.trim()} (${MOD_CATEGORY_LABELS[modCategory]})\n\n${modDescription.trim()}`,
          carId: car.car_id || undefined,
          postedAsGarageCarId: car.id,
          category: "modifications",
        });
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
      setModTitle("");
      setModDescription("");
      setModCategory("other");
      setShareToFeed(false);
      setAddingMod(false);
      refreshMods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add mod");
    }
  }

  async function handleRemoveMod(id: string) {
    try {
      await removeMod(id);
      refreshMods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove mod");
    }
  }

  async function handleRemoveCar() {
    try {
      await removeGarageCar(car.id);
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      onRemoved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove car");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar photoUrl={car.photo_url} fallback={car.nickname} className="size-14" />
          <div>
            <p className="font-medium">
              {car.nickname} — {car.year ? `${car.year} ` : ""}
              {car.make} {car.model}
              {car.generation ? ` (${car.generation})` : ""}
            </p>
            {car.spec && <p className="mt-1 text-sm text-muted-foreground">{car.spec}</p>}
          </div>
        </div>
        {isOwner && (
          <button
            onClick={handleRemoveCar}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Remove from garage"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SpecTile icon={Zap} label="Power" value={car.horsepower ? `${car.horsepower} hp` : "—"} />
        <SpecTile icon={Cog} label="Engine" value={car.engine ?? "—"} />
        <SpecTile icon={Fuel} label="Fuel" value={car.fuel_type ? FUEL_TYPE_LABELS[car.fuel_type] : "—"} />
        <SpecTile icon={Palette} label="Color" value={car.color ?? "—"} />
      </div>
      {(car.trim || car.transmission || car.mileage != null) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {[car.trim, car.transmission ? TRANSMISSION_LABELS[car.transmission] : null, car.mileage != null ? `${car.mileage.toLocaleString()} miles` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {car.bio && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
          <p className="text-sm">{car.bio}</p>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Photos</h3>
          {isOwner && (
            <button
              onClick={() => setAddingPhoto((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
        {isOwner && addingPhoto && (
          <form onSubmit={handleAddPhoto} className="mb-2 flex gap-2">
            <input
              value={photoUrlInput}
              onChange={(e) => setPhotoUrlInput(e.target.value)}
              placeholder="https://…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add
            </button>
          </form>
        )}
        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-video overflow-hidden rounded-md bg-muted">
                <img src={photo.photo_url} alt="" className="size-full object-cover" />
                {isOwner && (
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        )}
      </div>

      {(mods?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {mods?.map((mod: GarageMod) => (
            <li key={mod.id} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{mod.title}</span>
                {mod.category && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {MOD_CATEGORY_LABELS[mod.category]}
                  </span>
                )}
                {mod.description && (
                  <span className="text-muted-foreground"> — {mod.description}</span>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={() => handleRemoveMod(mod.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <div className="mt-3 border-t border-border pt-3">
          {addingMod ? (
            <form onSubmit={handleAddMod} className="space-y-2">
              <input
                value={modTitle}
                onChange={(e) => setModTitle(e.target.value)}
                placeholder="Mod title, e.g. Coilovers"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                autoFocus
              />
              <select
                value={modCategory}
                onChange={(e) => setModCategory(e.target.value as NonNullable<GarageMod["category"]>)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                {Object.entries(MOD_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={modDescription}
                onChange={(e) => setModDescription(e.target.value)}
                placeholder="Details (required to share to the feed)"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={shareToFeed}
                  onChange={(e) => setShareToFeed(e.target.checked)}
                />
                Share this mod to the feed
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save mod
                </button>
                <button
                  type="button"
                  onClick={() => setAddingMod(false)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingMod(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              + Add a mod
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SpecTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <Icon className="size-4 text-primary" />
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  addMod,
  fetchMods,
  removeGarageCar,
  removeMod,
  MOD_CATEGORY_LABELS,
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

  const { data: mods } = useQuery({
    queryKey: ["garage-mods", car.id],
    queryFn: () => fetchMods(car.id),
  });

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

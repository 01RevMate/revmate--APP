import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addMod, fetchMods, removeGarageCar, removeMod, type GarageCar, type GarageMod } from "@/lib/garage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function GarageCarCard({ car, isOwner }: { car: GarageCar; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [addingMod, setAddingMod] = useState(false);
  const [modTitle, setModTitle] = useState("");
  const [modDescription, setModDescription] = useState("");

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
    try {
      await addMod(car.id, modTitle.trim(), modDescription.trim() || undefined);
      setModTitle("");
      setModDescription("");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove car");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {car.nickname ? `${car.nickname} — ` : ""}
            {car.year ? `${car.year} ` : ""}
            {car.make} {car.model}
            {car.generation ? ` (${car.generation})` : ""}
          </p>
          {car.spec && <p className="mt-1 text-sm text-muted-foreground">{car.spec}</p>}
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
              <input
                value={modDescription}
                onChange={(e) => setModDescription(e.target.value)}
                placeholder="Details (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
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

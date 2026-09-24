import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Zap,
  Cog,
  Fuel,
  Palette,
  Plus,
  Heart,
  ThumbsDown,
  UserPlus,
  UserCheck,
  Trophy,
  Tag,
  Loader2,
  KeyRound,
  Undo2,
  Image,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  addCarPhoto,
  addMod,
  dislikeGarageCar,
  fetchCarPhotos,
  fetchGarageCarRank,
  fetchMods,
  followGarageCar,
  hasDislikedGarageCar,
  hasFollowedGarageCar,
  hasLikedGarageCar,
  likeGarageCar,
  removeCarPhoto,
  removeGarageCar,
  removeMod,
  setGarageCarOwnershipStatus,
  undislikeGarageCar,
  unfollowGarageCar,
  updateGarageCar,
  unlikeGarageCar,
  FUEL_TYPE_LABELS,
  MOD_CATEGORY_LABELS,
  TRANSMISSION_LABELS,
  type GarageCar,
  type GarageMod,
} from "@/lib/garage";
import { fetchListingsForGarageCar } from "@/lib/listings";
import { createPost } from "@/lib/posts";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";

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
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [likeBusy, setLikeBusy] = useState(false);
  const [addingMod, setAddingMod] = useState(false);
  const [modTitle, setModTitle] = useState("");
  const [modDescription, setModDescription] = useState("");
  const [modCategory, setModCategory] = useState<NonNullable<GarageMod["category"]>>("other");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mainPhotoBusy, setMainPhotoBusy] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isPrevious = car.ownership_status === "previous";

  const { data: mods } = useQuery({
    queryKey: ["garage-mods", car.id],
    queryFn: () => fetchMods(car.id),
  });

  const { data: liked, refetch: refetchLiked } = useQuery({
    queryKey: ["garage-car-liked", car.id, user?.id],
    enabled: !!user,
    queryFn: () => hasLikedGarageCar(car.id, user!.id),
  });

  const { data: disliked, refetch: refetchDisliked } = useQuery({
    queryKey: ["garage-car-disliked", car.id, user?.id],
    enabled: !!user,
    queryFn: () => hasDislikedGarageCar(car.id, user!.id),
  });

  const { data: followed, refetch: refetchFollowed } = useQuery({
    queryKey: ["garage-car-followed", car.id, user?.id],
    enabled: !!user,
    queryFn: () => hasFollowedGarageCar(car.id, user!.id),
  });

  const { data: rank } = useQuery({
    queryKey: ["garage-car-rank", car.id],
    queryFn: () => fetchGarageCarRank(car.id),
  });

  const { data: activeListing } = useQuery({
    queryKey: ["garage-car-listing", car.id],
    queryFn: () => fetchListingsForGarageCar(car.id),
  });
  const forSale = (activeListing?.length ?? 0) > 0;

  const [dislikeBusy, setDislikeBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  function invalidateReactions() {
    queryClient.invalidateQueries({ queryKey: ["garage-car-liked", car.id] });
    queryClient.invalidateQueries({ queryKey: ["garage-car-disliked", car.id] });
    queryClient.invalidateQueries({ queryKey: ["garage-car-rank", car.id] });
    queryClient.invalidateQueries({ queryKey: ["garage-car", car.id] });
  }

  async function toggleLike() {
    if (!user) {
      openAuthModal("Create a free account to like a build.");
      return;
    }
    setLikeBusy(true);
    try {
      if (liked) await unlikeGarageCar(car.id, user.id);
      else await likeGarageCar(car.id, user.id);
      refetchLiked();
      refetchDisliked();
      invalidateReactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleDislike() {
    if (!user) {
      openAuthModal("Create a free account to react to a build.");
      return;
    }
    setDislikeBusy(true);
    try {
      if (disliked) await undislikeGarageCar(car.id, user.id);
      else await dislikeGarageCar(car.id, user.id);
      refetchDisliked();
      refetchLiked();
      invalidateReactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update dislike");
    } finally {
      setDislikeBusy(false);
    }
  }

  async function toggleFollow() {
    if (!user) {
      openAuthModal("Create a free account to follow a car.");
      return;
    }
    setFollowBusy(true);
    try {
      if (followed) await unfollowGarageCar(car.id, user.id);
      else await followGarageCar(car.id, user.id);
      refetchFollowed();
      queryClient.invalidateQueries({ queryKey: ["garage-car", car.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update follow");
    } finally {
      setFollowBusy(false);
    }
  }

  const { data: photos } = useQuery({
    queryKey: ["garage-car-photos", car.id],
    queryFn: () => fetchCarPhotos(car.id),
  });

  function refreshPhotos() {
    queryClient.invalidateQueries({ queryKey: ["garage-car-photos", car.id] });
  }

  async function handlePhotoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadImage("user-media", user.id, file);
      await addCarPhoto(car.id, url);
      refreshPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add photo");
    } finally {
      setUploadingPhoto(false);
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

  async function handleSetMainPhoto(photoUrl: string) {
    if (photoUrl === car.photo_url) return;
    setMainPhotoBusy(photoUrl);
    try {
      await updateGarageCar(car.id, { photo_url: photoUrl });
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      queryClient.invalidateQueries({ queryKey: ["garage-car", car.id] });
      toast.success("Main photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the main photo");
    } finally {
      setMainPhotoBusy(null);
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
    if (
      !confirm(
        "Remove this car for good? This can't be undone — if you just sold it, mark it as previously owned instead.",
      )
    ) {
      return;
    }
    try {
      await removeGarageCar(car.id);
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      onRemoved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove car");
    }
  }

  async function handleToggleOwnershipStatus() {
    setStatusBusy(true);
    try {
      const nextStatus = isPrevious ? "current" : "previous";
      await setGarageCarOwnershipStatus(car.id, nextStatus);
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      queryClient.invalidateQueries({ queryKey: ["garage-car", car.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update car");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 ${isPrevious ? "border-border opacity-75" : forSale ? "border-blue-500 ring-1 ring-blue-500" : "border-border"} bg-card`}
    >
      {forSale && (
        <div className="mb-3 flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-500">
          <Tag className="size-3.5" />
          For sale
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar
              photoUrl={car.photo_url}
              fallback={car.nickname}
              className={`size-14 ${isPrevious ? "grayscale" : ""}`}
            />
            <CarLogo
              make={car.make}
              className="absolute -bottom-1 -right-1 size-5 rounded-full border border-background bg-background"
            />
          </div>
          <div>
            <p className="font-medium">
              {car.nickname} — {car.year ? `${car.year} ` : ""}
              {car.make} {car.model}
              {car.generation ? ` (${car.generation})` : ""}
            </p>
            {isPrevious && (
              <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Previously owned
              </span>
            )}
            {car.spec && <p className="mt-1 text-sm text-muted-foreground">{car.spec}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={toggleLike}
            disabled={likeBusy}
            className={`flex items-center gap-1.5 text-sm ${liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
            title="Like this car"
          >
            <Heart className="size-4" fill={liked ? "currentColor" : "none"} />
            {car.likes_count}
          </button>
          <button
            onClick={toggleDislike}
            disabled={dislikeBusy}
            className={`flex items-center gap-1.5 text-sm ${disliked ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Dislike this car"
          >
            <ThumbsDown className="size-4" fill={disliked ? "currentColor" : "none"} />
            {car.dislikes_count}
          </button>
          {rank && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Trophy className="size-3.5 text-yellow-500" />#{rank}
            </span>
          )}
          {!isOwner && (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`flex items-center gap-1.5 text-sm ${followed ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title={followed ? "Unfollow this car" : "Follow this car"}
            >
              {followed ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {car.followers_count}
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={handleToggleOwnershipStatus}
                disabled={statusBusy}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                title={isPrevious ? "Mark as currently owned" : "Mark as sold / previously owned"}
              >
                {isPrevious ? <Undo2 className="size-4" /> : <KeyRound className="size-4" />}
              </button>
              <button
                onClick={handleRemoveCar}
                className="text-muted-foreground hover:text-destructive"
                title="Remove from garage permanently"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {isOwner && !isPrevious && (
        <Link
          to="/sell"
          search={{ garageCarId: car.id }}
          className="mt-3 inline-block text-xs font-medium text-primary underline"
        >
          {forSale ? "Manage this listing" : "List this car for sale"}
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SpecTile icon={Zap} label="Power" value={car.horsepower ? `${car.horsepower} hp` : "—"} />
        <SpecTile icon={Cog} label="Engine" value={car.engine ?? "—"} />
        <SpecTile
          icon={Fuel}
          label="Fuel"
          value={car.fuel_type ? FUEL_TYPE_LABELS[car.fuel_type] : "—"}
        />
        <SpecTile icon={Palette} label="Color" value={car.color ?? "—"} />
      </div>
      {(car.trim || car.transmission || car.mileage != null) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {[
            car.trim,
            car.transmission ? TRANSMISSION_LABELS[car.transmission] : null,
            car.mileage != null ? `${car.mileage.toLocaleString()} miles` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {car.bio && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            About
          </h3>
          <p className="text-sm">{car.bio}</p>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Photos
          </h3>
          {isOwner && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoFileSelected}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Add photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            </>
          )}
        </div>
        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-video overflow-hidden rounded-md bg-muted"
              >
                <img src={photo.photo_url} alt="" className="size-full object-cover" />
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleSetMainPhoto(photo.photo_url)}
                      disabled={photo.photo_url === car.photo_url || mainPhotoBusy !== null}
                      title={
                        photo.photo_url === car.photo_url
                          ? "Current main photo"
                          : "Use as main photo"
                      }
                      className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white disabled:cursor-default disabled:opacity-80"
                    >
                      {mainPhotoBusy === photo.photo_url ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Image className="size-3" />
                      )}
                      {photo.photo_url === car.photo_url ? "Main photo" : "Make main"}
                    </button>
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      title="Remove photo"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </>
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
                onChange={(e) =>
                  setModCategory(e.target.value as NonNullable<GarageMod["category"]>)
                }
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

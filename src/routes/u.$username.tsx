import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, UserPlus, UserX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { PERSONA_LABELS } from "@/hooks/useProfile";
import {
  fetchProfileByUsername,
  updateProfile,
  SOCIAL_PLATFORMS,
  type Profile,
} from "@/lib/profiles";
import {
  addGarageCar,
  fetchGarage,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  type GarageCar,
} from "@/lib/garage";
import { fetchMyLikedPostIds, fetchPostsByUser } from "@/lib/posts";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { GarageCarTile } from "@/components/GarageCarTile";
import { PostCard } from "@/components/PostCard";
import { SocialLinksDisplay, SocialLinksEditor } from "@/components/SocialLinks";
import { AchievementBadges } from "@/components/AchievementBadges";
import { FriendButton } from "@/components/FriendButton";
import { FriendsSection } from "@/components/FriendsSection";
import { EditableImage } from "@/components/EditableImage";
import { ImageUploadField } from "@/components/ImageUploadField";
import { CarLogo } from "@/components/CarLogo";
import { PostingIdentitySwitcher } from "@/components/PostingIdentitySwitcher";
import { VehicleCatalogPicker } from "@/components/VehicleCatalogPicker";
import { Button } from "@/components/ui/button";
import { carLabel, type Car } from "@/lib/cars";
import { blockProfile, fetchBlock, unblockProfile } from "@/lib/moderation";
import { displayUsername } from "@/lib/usernames";
import {
  EMPTY_VEHICLE_CATALOG_SELECTION,
  garageFuelTypeForCatalogFuel,
  type VehicleCatalogSelection,
} from "@/lib/vehicleCatalog";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [{ title: `${displayUsername(params.username)} — RevMate` }],
  }),
  component: GarageProfilePage,
});

function GarageProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: () => fetchProfileByUsername(username),
  });

  const isOwner = !!user && !!profile && user.id === profile.user_id;

  const { data: block } = useQuery({
    queryKey: ["user-block", user?.id, profile?.user_id],
    enabled: !!user && !!profile && !isOwner,
    queryFn: () => fetchBlock(user!.id, profile!.user_id),
  });

  const { data: garage } = useQuery({
    queryKey: ["garage", profile?.user_id],
    enabled: !!profile,
    queryFn: () => fetchGarage(profile!.user_id),
  });

  const { data: posts } = useQuery({
    queryKey: ["posts-by-user", profile?.user_id],
    enabled: !!profile,
    queryFn: () => fetchPostsByUser(profile!.user_id),
  });

  const { data: likedPostIds } = useQuery({
    queryKey: ["posts-by-user", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((p) => p.id),
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  const { data: questions } = useQuery({
    queryKey: ["my-questions", profile?.user_id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*, cars(make, model, generation)")
        .eq("user_id", profile!.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function refreshProfile() {
    queryClient.invalidateQueries({ queryKey: ["profile-by-username", username] });
  }

  function refreshGarage() {
    queryClient.invalidateQueries({ queryKey: ["garage", profile?.user_id] });
  }

  async function toggleBlock() {
    if (!user || !profile) return openAuthModal("Create a free account to block profiles.");
    try {
      if (block) {
        await unblockProfile(user.id, profile.user_id);
        toast.success("Profile unblocked.");
      } else {
        if (
          !window.confirm(
            `Block ${displayUsername(profile.username)}? Their posts will disappear and they won't be able to message you.`,
          )
        )
          return;
        await blockProfile(user.id, profile.user_id);
        toast.success("Profile blocked.");
      }
      queryClient.invalidateQueries({ queryKey: ["user-block", user.id, profile.user_id] });
      queryClient.invalidateQueries({ queryKey: ["posts-by-user", profile.user_id] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update this block");
    }
  }

  if (isLoading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There's no RevMate profile at {displayUsername(username)}.
        </p>
      </div>
    );
  }

  async function handleCoverUploaded(url: string) {
    await updateProfile(profile!.user_id, { cover_photo_url: url });
    refreshProfile();
  }

  async function handleAvatarUploaded(url: string) {
    await updateProfile(profile!.user_id, { avatar_url: url });
    refreshProfile();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <EditableImage
        userId={profile.user_id}
        editable={isOwner}
        onUploaded={handleCoverUploaded}
        className="h-40 w-full bg-muted sm:h-56"
        rounded="rounded-none"
        label="Change cover"
        showTrigger={editing}
        aspect={16 / 9}
        cropTitle="Crop your cover photo"
        successMessage="Cover photo updated."
      >
        {profile.cover_photo_url && (
          <img src={profile.cover_photo_url} alt="" className="size-full object-cover" />
        )}
      </EditableImage>

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <EditableImage
            userId={profile.user_id}
            editable={isOwner}
            onUploaded={handleAvatarUploaded}
            showTrigger={editing}
            aspect={1}
            circular
            cropTitle="Crop your profile picture"
            successMessage="Profile picture updated."
          >
            <Avatar
              photoUrl={profile.avatar_url}
              fallback={profile.username}
              className="size-20 border-4 border-background"
            />
          </EditableImage>
          {isOwner ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              className="mb-0 self-end"
            >
              {editing ? "Close" : "Edit profile"}
            </Button>
          ) : (
            <div className="mt-12 flex flex-wrap gap-2 self-end">
              {!block && (
                <Link
                  to="/messages/$username"
                  params={{ username: profile.username }}
                  onClick={(e) => {
                    if (!user) {
                      e.preventDefault();
                      openAuthModal(`Create a free account to message ${displayUsername(profile.username)}.`);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <MessageCircle className="size-3.5" />
                  Message
                </Link>
              )}
              {!block &&
                (user ? (
                  <FriendButton myId={user.id} otherId={profile.user_id} />
                ) : (
                  <button
                    onClick={() => openAuthModal("Create a free account to add friends.")}
                    className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  >
                    <UserPlus className="size-3.5" />
                    Add Friend
                  </button>
                ))}
              <button
                onClick={toggleBlock}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent ${block ? "border-destructive/40 text-destructive" : "border-input"}`}
              >
                <UserX className="size-3.5" /> {block ? "Unblock" : "Block"}
              </button>
            </div>
          )}
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayUsername(profile.username)}</h1>
        <p className="text-sm text-muted-foreground">{PERSONA_LABELS[profile.persona]}</p>
        {profile.bio && (
          <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm">{profile.bio}</p>
        )}

        <div className="mt-3">
          <SocialLinksDisplay profile={profile} />
        </div>
        <div className="mt-3">
          <AchievementBadges userId={profile.user_id} />
        </div>

        {isOwner && editing && (
          <EditProfileForm
            profile={profile}
            onSaved={refreshProfile}
            onDone={() => setEditing(false)}
          />
        )}

        {isOwner && (
          <Section title="Friends">
            <FriendsSection userId={profile.user_id} />
          </Section>
        )}

        <Section title="Garage">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {garage
              ?.filter((car) => car.ownership_status !== "previous")
              .map((car) => (
                <GarageCarTile key={car.id} username={profile.username} car={car} />
              ))}
          </div>
          {garage?.length === 0 && !adding && (
            <p className="mt-2 text-sm text-muted-foreground">No cars in the garage yet.</p>
          )}
          {garage?.some((car) => car.ownership_status === "previous") && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Previously owned
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {garage
                  ?.filter((car) => car.ownership_status === "previous")
                  .map((car) => (
                    <GarageCarTile key={car.id} username={profile.username} car={car} />
                  ))}
              </div>
            </div>
          )}
          {isOwner && (
            <div className="mt-3">
              {adding ? (
                <AddCarForm
                  userId={user!.id}
                  onAdded={() => {
                    setAdding(false);
                    refreshGarage();
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setAdding(true)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    + Add a car
                  </button>
                  {(garage?.some((car) => car.ownership_status !== "previous") ?? false) && (
                    <PostingIdentitySwitcher
                      userId={user!.id}
                      username={profile.username}
                      activeGarageCarId={profile.active_garage_car_id}
                      cars={garage!.filter((car) => car.ownership_status !== "previous")}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Activity">
          <div className="space-y-4">
            {posts?.map((post) => (
              <PostCard key={post.id} post={post} liked={likedPostIds?.has(post.id) ?? false} />
            ))}
            {posts?.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
          </div>
        </Section>

        <Section title="Questions asked">
          <ul className="space-y-2">
            {questions?.map((question) => (
              <li key={question.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{question.title}</p>
                {question.cars && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {carLabel(question.cars as Car)}
                  </p>
                )}
              </li>
            ))}
            {questions?.length === 0 && (
              <li className="text-sm text-muted-foreground">No questions posted yet.</li>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function EditProfileForm({
  profile,
  onSaved,
  onDone,
}: {
  profile: Profile;
  onSaved: () => void;
  onDone: () => void;
}) {
  const [persona, setPersona] = useState<Profile["persona"]>(profile.persona);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [socialLinks, setSocialLinks] = useState({
    social_instagram: profile.social_instagram ?? "",
    social_facebook: profile.social_facebook ?? "",
    social_tiktok: profile.social_tiktok ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    for (const platform of SOCIAL_PLATFORMS) {
      const value = socialLinks[platform.key].trim();
      if (value && !platform.validate(value)) {
        toast.error(`${platform.label} link doesn't look like a valid ${platform.label} URL.`);
        return;
      }
    }
    setSaving(true);
    try {
      await updateProfile(profile.user_id, {
        persona,
        bio: bio.trim() || null,
        social_instagram: socialLinks.social_instagram.trim() || null,
        social_facebook: socialLinks.social_facebook.trim() || null,
        social_tiktok: socialLinks.social_tiktok.trim() || null,
      });
      onSaved();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <Field label="I'm a…">
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value as Profile["persona"])}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Object.entries(PERSONA_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="Tell people a little about you"
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/160</p>
      </Field>
      <SocialLinksEditor
        values={socialLinks}
        onChange={(key, value) => setSocialLinks((prev) => ({ ...prev, [key]: value }))}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <Link
          to="/settings"
          className="rounded-md border border-input px-4 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Account settings
        </Link>
      </div>
    </form>
  );
}

function AddCarForm({
  userId,
  onAdded,
  onCancel,
}: {
  userId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [catalogSelection, setCatalogSelection] = useState<VehicleCatalogSelection>(
    EMPTY_VEHICLE_CATALOG_SELECTION,
  );
  const [nickname, setNickname] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [generation, setGeneration] = useState("");
  const [year, setYear] = useState("");
  const [spec, setSpec] = useState("");
  const [trim, setTrim] = useState("");
  const [engine, setEngine] = useState("");
  const [horsepower, setHorsepower] = useState("");
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");
  const [fuelType, setFuelType] = useState<GarageCar["fuel_type"]>(null);
  const [transmission, setTransmission] = useState<GarageCar["transmission"]>(null);
  const [bio, setBio] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const vehicleReady =
    !!catalogSelection.make.trim() &&
    !!catalogSelection.model.trim() &&
    (!catalogSelection.makeId ||
      (!!catalogSelection.modelId &&
        !!catalogSelection.derivativeId &&
        !!catalogSelection.powertrainId &&
        !!catalogSelection.engine));
  const detailsReady = vehicleReady && !!nickname.trim();
  const currentStep = reviewing ? 3 : vehicleReady ? 2 : 1;

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (detailsReady) setReviewing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const make = catalogSelection.make;
    const model = catalogSelection.model;
    if (!make.trim() || !model.trim() || !nickname.trim()) return;
    setSaving(true);
    try {
      await addGarageCar({
        userId,
        make: make.trim(),
        model: model.trim(),
        nickname: nickname.trim(),
        photoUrl: photoUrl.trim() || undefined,
        catalogMakeId: catalogSelection.makeId || undefined,
        catalogModelId: catalogSelection.modelId || undefined,
        catalogDerivativeId: catalogSelection.derivativeId || undefined,
        catalogPowertrainId: catalogSelection.powertrainId || undefined,
        generation: generation.trim() || undefined,
        year: year ? Number(year) : undefined,
        spec: spec.trim() || undefined,
        trim: trim.trim() || undefined,
        engine: engine.trim() || undefined,
        horsepower: horsepower ? Number(horsepower) : undefined,
        mileage: mileage ? Number(mileage) : undefined,
        color: color.trim() || undefined,
        fuelType: fuelType || undefined,
        transmission: transmission || undefined,
        bio: bio.trim() || undefined,
      });
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add car");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={reviewing ? handleSubmit : handleReview}
      className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-xl font-bold">Add a car</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Build the car in order, check it, then add it to your garage.
        </p>
      </div>

      <AddCarProgress currentStep={currentStep} />

      {!reviewing && (
        <>
          <VehicleCatalogPicker
            value={catalogSelection}
            onChange={(next) => {
              setCatalogSelection(next);
              setTrim(next.derivative);
              setEngine(next.engine);
              setFuelType(
                next.fuelTypeCode ? garageFuelTypeForCatalogFuel(next.fuelTypeCode) : null,
              );
            }}
          />

          {vehicleReady && (
            <section className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
              <div>
                <h3 className="font-semibold">Additional information</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Give the car a name. Everything else here is optional.
                </p>
              </div>
              <Field label="Car name">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  autoFocus
                  placeholder="e.g. My daily, Track car or Bluey"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUploadField
                  label="Car photo"
                  userId={userId}
                  value={photoUrl}
                  onChange={setPhotoUrl}
                />
                <Field label="Year">
                  <input
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    type="number"
                    min="1886"
                    max="2100"
                    placeholder="e.g. 2018"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <Field label="Generation">
                  <input
                    value={generation}
                    onChange={(e) => setGeneration(e.target.value)}
                    placeholder="e.g. Mk7"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <Field label="Horsepower">
                  <input
                    value={horsepower}
                    onChange={(e) => setHorsepower(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="e.g. 245"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <Field label="Mileage">
                  <input
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="e.g. 45000"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <Field label="Colour">
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Frozen Black"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <Field label="Transmission">
                  <select
                    value={transmission ?? ""}
                    onChange={(e) =>
                      setTransmission((e.target.value || null) as GarageCar["transmission"])
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  >
                    <option value="">—</option>
                    {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Spec notes">
                  <input
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    placeholder="e.g. Performance Pack, DSG"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="About the car">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      placeholder="Tell people what makes this car yours…"
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
                    />
                  </Field>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {reviewing && (
        <CarReview
          selection={catalogSelection}
          nickname={nickname}
          photoUrl={photoUrl}
          year={year}
          generation={generation}
          trim={trim}
          engine={engine}
          horsepower={horsepower}
          mileage={mileage}
          color={color}
          fuelType={fuelType}
          transmission={transmission}
          spec={spec}
          bio={bio}
        />
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={reviewing ? () => setReviewing(false) : onCancel}
          className="rounded-xl border border-input px-4 py-2.5 text-sm font-medium hover:bg-accent"
        >
          {reviewing ? "Back to edit" : "Cancel"}
        </button>
        <button
          type="submit"
          disabled={saving || !detailsReady}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Adding your car…" : reviewing ? "Yes, add this car" : "Review car"}
        </button>
      </div>
    </form>
  );
}

function AddCarProgress({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Add car progress">
      {["Vehicle", "Details", "Review"].map((label, index) => {
        const step = index + 1;
        const complete = step < currentStep;
        const active = step === currentStep;
        return (
          <li key={label} className="text-center">
            <div
              className={`mx-auto mb-1.5 flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                complete || active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {complete ? <CheckCircle2 className="size-4" /> : step}
            </div>
            <span className={`text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CarReview({
  selection,
  nickname,
  photoUrl,
  year,
  generation,
  trim,
  engine,
  horsepower,
  mileage,
  color,
  fuelType,
  transmission,
  spec,
  bio,
}: {
  selection: VehicleCatalogSelection;
  nickname: string;
  photoUrl: string;
  year: string;
  generation: string;
  trim: string;
  engine: string;
  horsepower: string;
  mileage: string;
  color: string;
  fuelType: GarageCar["fuel_type"];
  transmission: GarageCar["transmission"];
  spec: string;
  bio: string;
}) {
  const details = [
    ["Year", year],
    ["Generation", generation],
    ["Trim", trim !== selection.derivative ? trim : ""],
    ["Engine", engine],
    ["Fuel", fuelType ? FUEL_TYPE_LABELS[fuelType] : ""],
    ["Transmission", transmission ? TRANSMISSION_LABELS[transmission] : ""],
    ["Power", horsepower ? `${horsepower} hp` : ""],
    ["Mileage", mileage ? `${Number(mileage).toLocaleString()} miles` : ""],
    ["Colour", color],
    ["Spec", spec],
  ].filter((detail) => detail[1]);

  return (
    <section className="space-y-5">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <h3 className="mt-2 text-xl font-bold">Is everything okay here?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the details before adding the car.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
        <div className="flex items-center gap-4 border-b border-border bg-card p-5">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <CarLogo make={selection.make} className="size-14" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{nickname}</p>
            <h4 className="truncate text-lg font-bold">
              {selection.make} {selection.model}
            </h4>
            {selection.derivative && (
              <p className="mt-1 text-sm text-muted-foreground">{selection.derivative}</p>
            )}
          </div>
        </div>
        {details.length > 0 && (
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {bio && <p className="border-t border-border bg-card p-4 text-sm">{bio}</p>}
      </div>
    </section>
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

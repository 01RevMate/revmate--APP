import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PERSONA_LABELS } from "@/hooks/useProfile";
import { fetchProfileByUsername, updateProfile, SOCIAL_PLATFORMS, type Profile } from "@/lib/profiles";
import {
  addGarageCar,
  fetchGarage,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  type GarageCar,
} from "@/lib/garage";
import { fetchPostsByUser } from "@/lib/posts";
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
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";
import { carLabel, type Car } from "@/lib/cars";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [{ title: `${params.username} — RevMate` }],
  }),
  component: GarageProfilePage,
});

function GarageProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: () => fetchProfileByUsername(username),
  });

  const isOwner = !!user && !!profile && user.id === profile.user_id;

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

  if (isLoading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">There's no RevMate profile at @{username}.</p>
      </div>
    );
  }

  async function handleCoverUploaded(url: string) {
    try {
      await updateProfile(profile!.user_id, { cover_photo_url: url });
      refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save cover photo");
    }
  }

  async function handleAvatarUploaded(url: string) {
    try {
      await updateProfile(profile!.user_id, { avatar_url: url });
      refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save profile picture");
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <EditableImage
        userId={profile.user_id}
        editable={isOwner}
        onUploaded={handleCoverUploaded}
        className="h-40 w-full bg-muted sm:h-56"
        rounded="rounded-none"
      >
        {profile.cover_photo_url && (
          <img src={profile.cover_photo_url} alt="" className="size-full object-cover" />
        )}
      </EditableImage>

      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <EditableImage userId={profile.user_id} editable={isOwner} onUploaded={handleAvatarUploaded}>
            <Avatar photoUrl={profile.avatar_url} fallback={profile.username} className="size-20 border-4 border-background" />
          </EditableImage>
          {isOwner ? (
            <button
              onClick={() => setEditing((v) => !v)}
              className="mb-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              {editing ? "Close" : "Edit profile"}
            </button>
          ) : (
            user && (
              <div className="mb-2 flex gap-2">
                <Link
                  to="/messages/$username"
                  params={{ username: profile.username }}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <MessageCircle className="size-3.5" />
                  Message
                </Link>
                <FriendButton myId={user.id} otherId={profile.user_id} />
              </div>
            )
          )}
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{profile.username}</h1>
        <p className="text-sm text-muted-foreground">{PERSONA_LABELS[profile.persona]}</p>

        <div className="mt-3">
          <SocialLinksDisplay profile={profile} />
        </div>
        <div className="mt-3">
          <AchievementBadges userId={profile.user_id} />
        </div>

        {isOwner && editing && (
          <EditProfileForm profile={profile} onSaved={refreshProfile} onDone={() => setEditing(false)} />
        )}

        {isOwner && (
          <Section title="Friends">
            <FriendsSection userId={profile.user_id} />
          </Section>
        )}

        <Section title="Garage">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {garage?.filter((car) => car.ownership_status !== "previous").map((car) => (
              <GarageCarTile key={car.id} username={username} car={car} />
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
                    <GarageCarTile key={car.id} username={username} car={car} />
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
                <button
                  onClick={() => setAdding(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  + Add a car
                </button>
              )}
            </div>
          )}
        </Section>

        <Section title="Activity">
          <div className="space-y-4">
            {posts?.map((post) => <PostCard key={post.id} post={post} liked={false} />)}
            {posts?.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
          </div>
        </Section>

        <Section title="Questions asked">
          <ul className="space-y-2">
            {questions?.map((question) => (
              <li key={question.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{question.title}</p>
                {question.cars && (
                  <p className="mt-1 text-xs text-muted-foreground">{carLabel(question.cars as Car)}</p>
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
    <form onSubmit={handleSave} className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
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
        <Link to="/settings" className="rounded-md border border-input px-4 py-1.5 text-sm font-medium hover:bg-accent">
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
  const [advanced, setAdvanced] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
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
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !nickname.trim()) return;
    setSaving(true);
    try {
      await addGarageCar({
        userId,
        make: make.trim(),
        model: model.trim(),
        nickname: nickname.trim(),
        photoUrl: photoUrl.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Field label="Car name (shown when you post as this car)">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          placeholder="e.g. Track Car, Daily, or just the model"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Make">
          <div className="flex items-center gap-2">
            <CarLogo make={make} className="size-8" />
            <MakeSelect
              value={make}
              onChange={(next) => {
                setMake(next);
                setModel("");
              }}
              required
            />
          </div>
        </Field>
        <Field label="Model">
          <ModelSelect make={make} value={model} onChange={setModel} required />
        </Field>
      </div>

      {advanced && (
        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField label="Car photo" userId={userId} value={photoUrl} onChange={setPhotoUrl} />
          <Field label="Year">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              type="number"
              placeholder="e.g. 2018"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Generation">
            <input
              value={generation}
              onChange={(e) => setGeneration(e.target.value)}
              placeholder="e.g. Mk7"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Trim">
            <input
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. Competition"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Engine">
            <input
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder="e.g. 2.0 TSI"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Horsepower">
            <input
              value={horsepower}
              onChange={(e) => setHorsepower(e.target.value)}
              type="number"
              placeholder="e.g. 245"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Mileage">
            <input
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              type="number"
              placeholder="e.g. 45000"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Color">
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. Frozen Black"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Fuel">
            <select
              value={fuelType ?? ""}
              onChange={(e) => setFuelType((e.target.value || null) as GarageCar["fuel_type"])}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Transmission">
            <select
              value={transmission ?? ""}
              onChange={(e) => setTransmission((e.target.value || null) as GarageCar["transmission"])}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us about this car…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {advanced ? "Hide advanced details" : "+ Advanced details"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add car"}
          </button>
        </div>
      </div>
    </form>
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

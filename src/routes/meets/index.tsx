import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AGE_LIMITS, useOldEnough } from "@/lib/legal";

import { useAuthModal } from "@/hooks/useAuthModal";
import { ImageUploadField } from "@/components/ImageUploadField";
import { MeetsComingSoon } from "@/components/MeetsComingSoon";
import { useEngagementFeatures, useSocialFeaturesStatus } from "@/lib/features";
import { geocodeAddress, setMeetLocation } from "@/lib/engagement";
import {
  createMeet,
  fetchMyMeets,
  fetchMyRsvps,
  fetchUpcomingMeets,
  type MeetWithOrganizer,
} from "@/lib/meets";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/meets/")({
  head: () => ({
    meta: [
      { title: "Car Meets & Events — RevMate" },
      {
        name: "description",
        content:
          "Find car meets, cars & coffee mornings and track days near you, and see who's going.",
      },
      { property: "og:title", content: "Car Meets & Events — RevMate" },
      {
        property: "og:description",
        content:
          "Find car meets, cars & coffee mornings and track days near you, and see who's going.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MeetsPage,
});

function MeetsPage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const socialStatus = useSocialFeaturesStatus();
  const social = socialStatus === "on";
  const [tab, setTab] = useState<"upcoming" | "mine">("upcoming");
  const [creating, setCreating] = useState(false);
  const oldEnoughToHost = useOldEnough(AGE_LIMITS.meets);

  const { data: upcoming, isLoading } = useQuery({
    queryKey: ["meets", "upcoming"],
    queryFn: fetchUpcomingMeets,
    enabled: social,
  });
  const { data: mine } = useQuery({
    queryKey: ["meets", "mine", user?.id],
    queryFn: () => fetchMyMeets(user!.id),
    enabled: social && !!user && tab === "mine",
  });
  const { data: rsvps } = useQuery({
    queryKey: ["meets", "rsvps", user?.id],
    queryFn: () => fetchMyRsvps(user!.id),
    enabled: social && !!user,
  });

  if (socialStatus === "checking") {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!social) return <MeetsComingSoon />;

  const meets = tab === "upcoming" ? upcoming : mine;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meets & Events</h1>
          <p className="text-sm text-muted-foreground">
            Cars & coffee, club meets, shows and track days.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            !user
              ? openAuthModal("Create a free account to post a meet.")
              : oldEnoughToHost
                ? setCreating((v) => !v)
                : toast.error(`Hosting meets is for people aged ${AGE_LIMITS.meets} and over.`)
          }
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          {creating ? "Close" : "Post a meet"}
        </button>
      </header>

      {creating && user && <CreateMeetForm userId={user.id} onDone={() => setCreating(false)} />}

      <div className="mt-5 inline-flex rounded-full border border-border p-0.5 text-sm">
        {(["upcoming", "mine"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              value === "mine" && !user
                ? openAuthModal("Create a free account to track your meets.")
                : setTab(value)
            }
            className={`rounded-full px-4 py-1 font-medium transition-colors ${tab === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {value === "upcoming" ? "Upcoming" : "My meets"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {isLoading &&
          tab === "upcoming" &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        {meets?.map((meet) => (
          <MeetCard key={meet.id} meet={meet} rsvp={rsvps?.get(meet.id)} />
        ))}
      </div>
      {meets?.length === 0 && (
        <p className="mt-4 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          {tab === "upcoming"
            ? "No meets coming up yet — post the first one!"
            : "You haven't organised or joined any meets yet."}
        </p>
      )}
    </main>
  );
}

function MeetCard({ meet, rsvp }: { meet: MeetWithOrganizer; rsvp?: string | undefined }) {
  const starts = new Date(meet.starts_at);
  const past = starts.getTime() < Date.now() - 6 * 60 * 60 * 1000;
  return (
    <Link
      to="/meets/$meetId"
      params={{ meetId: meet.id }}
      className={`overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-accent/40 ${past || meet.cancelled_at ? "opacity-70" : ""}`}
    >
      <div className="relative aspect-[16/9] bg-muted">
        {meet.cover_url ? (
          <img src={meet.cover_url} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
            <CalendarDays className="size-10 text-white/40" />
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-md bg-background/95 px-2 py-1 text-center shadow">
          <p className="text-[10px] font-semibold uppercase text-primary">
            {format(starts, "MMM")}
          </p>
          <p className="text-lg font-bold leading-none">{format(starts, "d")}</p>
        </div>
        {meet.cancelled_at && (
          <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Cancelled
          </span>
        )}
        {!meet.cancelled_at && rsvp && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            {rsvp === "going" ? "You're going" : "Interested"}
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="font-semibold leading-snug">{meet.title}</p>
        <p className="text-xs text-muted-foreground">{format(starts, "EEE d MMM · HH:mm")}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{meet.location_name}</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3 shrink-0" />
          {meet.going_count} going · {meet.interested_count} interested · by{" "}
          {displayUsernameWithoutAt(meet.profiles?.username)}
        </p>
      </div>
    </Link>
  );
}

function CreateMeetForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const engagement = useEngagementFeatures();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !startTime) {
      toast.error("Pick a date and start time.");
      return;
    }
    const startsAt = new Date(`${date}T${startTime}`);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("That date doesn't look right.");
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      toast.error("The meet needs to be in the future.");
      return;
    }
    let endsAt: Date | null = null;
    if (endTime) {
      endsAt = new Date(`${date}T${endTime}`);
      // An end time earlier than the start means it runs past midnight.
      if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
    }
    setSaving(true);
    try {
      const id = await createMeet({
        organizerId: userId,
        title,
        description,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        locationName,
        address: address || null,
        coverUrl: coverUrl || null,
      });
      // Put the meet on the Near you map (best effort — a failed lookup just
      // leaves it off the map).
      if (engagement) {
        const spot = await geocodeAddress([locationName, address].filter(Boolean).join(", "));
        if (spot) await setMeetLocation(id, spot.lat, spot.lng).catch(() => {});
      }
      toast.success("Meet posted");
      queryClient.invalidateQueries({ queryKey: ["meets"] });
      onDone();
      navigate({ to: "/meets/$meetId", params: { meetId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post the meet");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="font-semibold">Post a meet</h2>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={3}
        maxLength={100}
        placeholder="Name, e.g. Sunday Cars & Coffee"
        className={input}
      />
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 text-xs font-medium sm:col-span-1">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs font-medium">
          Starts
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={`${input} mt-1`}
          />
        </label>
        <label className="text-xs font-medium">
          Ends (optional)
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`${input} mt-1`}
          />
        </label>
      </div>
      <input
        value={locationName}
        onChange={(e) => setLocationName(e.target.value)}
        required
        minLength={2}
        maxLength={200}
        placeholder="Venue, e.g. Brooklands Museum"
        className={input}
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={300}
        placeholder="Address or postcode (helps the map find it)"
        className={input}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="What's the plan? Entry fee, parking, rules…"
        className={`${input} resize-none`}
      />
      <ImageUploadField
        label="Cover photo (optional)"
        userId={userId}
        value={coverUrl}
        onChange={setCoverUrl}
        shape="wide"
      />
      <div className="flex justify-end">
        <button
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post meet"}
        </button>
      </div>
    </form>
  );
}

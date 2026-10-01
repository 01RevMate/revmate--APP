import { useState } from "react";
import { fetchMeetSeo } from "@/lib/seoData";
import { meetHead } from "@/lib/seoHeads";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Camera,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Navigation,
  Share2,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { MapEmbed } from "@/components/MapEmbed";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { MeetsComingSoon } from "@/components/MeetsComingSoon";
import { useSocialFeaturesStatus } from "@/lib/features";
import {
  cancelMeet,
  deleteMeet,
  fetchAttendees,
  fetchMeet,
  mapsEmbedUrl,
  mapsSearchUrl,
  meetCalendarFile,
  setRsvp,
  type MeetStatus,
} from "@/lib/meets";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import { MeetCoverPicker } from "@/components/MeetCoverPicker";
import { meetCoverSrc, updateMeetCover } from "@/lib/meetCovers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/meets/$meetId")({
  loader: ({ params }) => fetchMeetSeo(params.meetId),
  head: ({ params, loaderData }) => meetHead(params.meetId, loaderData ?? null),
  component: MeetPage,
});

function MeetPage() {
  const { meetId } = Route.useParams();
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const socialStatus = useSocialFeaturesStatus();
  const social = socialStatus === "on";
  const [busy, setBusy] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const { data: meet, isLoading } = useQuery({
    queryKey: ["meet", meetId],
    queryFn: () => fetchMeet(meetId),
    enabled: social,
  });
  const { data: attendees } = useQuery({
    queryKey: ["meet", meetId, "attendees"],
    queryFn: () => fetchAttendees(meetId),
    enabled: social && !!meet,
  });

  if (socialStatus === "off") return <MeetsComingSoon />;
  if (!social || isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!meet) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Meet not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
        <Link to="/meets" className="mt-4 inline-block text-sm text-primary">
          ← All meets
        </Link>
      </main>
    );
  }

  const myStatus = attendees?.find((a) => a.user_id === user?.id)?.status ?? null;
  const isOrganizer = user?.id === meet.organizer_id;
  const starts = new Date(meet.starts_at);
  const ends = meet.ends_at ? new Date(meet.ends_at) : null;
  const going = attendees?.filter((a) => a.status === "going") ?? [];
  const interested = attendees?.filter((a) => a.status === "interested") ?? [];
  const finished = (ends ?? starts).getTime() < Date.now();
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["meet", meetId] });
    queryClient.invalidateQueries({ queryKey: ["meets"] });
  }

  async function rsvp(status: MeetStatus) {
    if (!user) return openAuthModal("Create a free account to RSVP to meets.");
    setBusy(true);
    try {
      await setRsvp(meetId, user.id, myStatus === status ? null : status);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your RSVP");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this meet? Everyone can still see it, marked as cancelled."))
      return;
    try {
      await cancelMeet(meetId);
      toast.success("Meet cancelled");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel the meet");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this meet for good?")) return;
    try {
      await deleteMeet(meetId);
      toast.success("Meet deleted");
      queryClient.invalidateQueries({ queryKey: ["meets"] });
      navigate({ to: "/meets" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the meet");
    }
  }

  async function handleShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: meet!.title, url: pageUrl });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  function downloadCalendar() {
    const blob = new Blob([meetCalendarFile(meet!, pageUrl)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meet!.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/meets" className="text-sm text-primary">
        ← All meets
      </Link>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative aspect-[16/9] bg-muted">
          <img src={meetCoverSrc(meet)} alt="" className="size-full object-cover" />
          {isOrganizer && user && (
            <button
              type="button"
              onClick={() => setCoverOpen(true)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/75"
            >
              <Camera className="size-3.5" /> {meet.cover_url ? "Change cover" : "Add a cover"}
            </button>
          )}
          {meet.cancelled_at && (
            <span className="absolute left-3 top-3 rounded-full bg-destructive px-3 py-1 text-xs font-semibold uppercase text-white">
              Cancelled
            </span>
          )}
        </div>

        <div className="space-y-4 p-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{meet.title}</h1>
            <Link
              to="/u/$username"
              params={{ username: meet.profiles?.username ?? "" }}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Avatar
                photoUrl={meet.profiles?.avatar_url}
                fallback={meet.profiles?.username}
                className="size-5"
              />
              Organised by {displayUsernameWithoutAt(meet.profiles?.username)}
              <VerifiedBadge userId={meet.organizer_id} />
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              {format(starts, "EEEE d MMMM yyyy · HH:mm")}
              {ends && ` – ${format(ends, "HH:mm")}`}
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium">{meet.location_name}</span>
                {meet.address && (
                  <span className="block text-muted-foreground">{meet.address}</span>
                )}
              </span>
            </p>
          </div>

          {!meet.cancelled_at && !finished && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => rsvp("going")}
                disabled={busy}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-60 ${myStatus === "going" ? "bg-emerald-600 text-white" : "border border-input hover:bg-accent"}`}
              >
                <Check className="size-4" />
                {myStatus === "going" ? "You're going" : "Going"}
              </button>
              <button
                type="button"
                onClick={() => rsvp("interested")}
                disabled={busy}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-60 ${myStatus === "interested" ? "bg-amber-500 text-white" : "border border-input hover:bg-accent"}`}
              >
                <Star
                  className="size-4"
                  fill={myStatus === "interested" ? "currentColor" : "none"}
                />
                Interested
              </button>
            </div>
          )}
          {myStatus && !meet.cancelled_at && !finished && (
            <p className="-mt-2 text-xs text-muted-foreground">
              We'll remind you the day before. Tap again to change your mind.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={mapsSearchUrl(meet)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Navigation className="size-3.5" />
              Directions
            </a>
            <button
              type="button"
              onClick={downloadCalendar}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <CalendarPlus className="size-3.5" />
              Add to calendar
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Share2 className="size-3.5" />
              Share
            </button>
          </div>

          {meet.description && (
            <p className="whitespace-pre-wrap text-sm">
              <RichText text={meet.description} />
            </p>
          )}

          <MapEmbed title={`Map of ${meet.location_name}`} src={mapsEmbedUrl(meet)} />

          <AttendeeList title={`Going (${meet.going_count})`} people={going} />
          {interested.length > 0 && (
            <AttendeeList title={`Interested (${meet.interested_count})`} people={interested} />
          )}

          {isOrganizer && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {!meet.cancelled_at && !finished && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  <XCircle className="size-3.5" />
                  Cancel meet
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {isOrganizer && user && (
        <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
          <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Meet cover</DialogTitle>
              <DialogDescription>Saved as soon as you pick one.</DialogDescription>
            </DialogHeader>
            <MeetCoverPicker
              userId={user.id}
              value={meet.cover_url ?? ""}
              onChange={async (url) => {
                try {
                  await updateMeetCover(meet.id, url || null);
                  refresh();
                  toast.success(url ? "Cover updated" : "Cover removed");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't update the cover");
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}

function AttendeeList({
  title,
  people,
}: {
  title: string;
  people: { user_id: string; profiles: { username: string; avatar_url: string | null } | null }[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {people.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one yet — be the first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <Link
              key={person.user_id}
              to="/u/$username"
              params={{ username: person.profiles?.username ?? "" }}
              className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5 text-xs hover:bg-accent"
            >
              <Avatar
                photoUrl={person.profiles?.avatar_url}
                fallback={person.profiles?.username}
                className="size-6"
              />
              {displayUsernameWithoutAt(person.profiles?.username)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

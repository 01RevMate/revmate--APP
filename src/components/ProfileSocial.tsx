import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import {
  fetchFollowers,
  fetchFollowing,
  fetchSocialCounts,
  followProfile,
  unfollowProfile,
  type FollowProfile,
} from "@/lib/follows";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export function ProfileStatsBar({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["social-counts", userId],
    queryFn: () => fetchSocialCounts(userId),
  });
  const stats = [
    [data?.posts ?? 0, "Posts"],
    [data?.followers ?? 0, "Followers"],
    [data?.following ?? 0, "Following"],
    [data?.likes ?? 0, "Likes"],
  ] as const;
  return (
    <div className="mt-4 flex flex-wrap gap-5">
      {stats.map(([value, label]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <p className="text-lg font-bold tabular-nums">{value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

// Up to five circles; past that the fifth becomes "+N" and opens the full list.
const MAX_CIRCLES = 5;

function PeopleRow({
  title,
  people,
}: {
  title: string;
  people: Awaited<ReturnType<typeof fetchFollowers>>;
}) {
  const [open, setOpen] = useState(false);
  const overflow = people.length > MAX_CIRCLES;
  const shown = overflow ? people.slice(0, MAX_CIRCLES - 1) : people;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {people.length ? (
        <div className="flex gap-3">
          {shown.map((person) => (
            <Link
              key={person.user_id}
              to="/u/$username"
              params={{ username: person.username }}
              className="w-16 shrink-0 text-center"
            >
              <Avatar
                photoUrl={person.avatar_url}
                fallback={person.username}
                className="mx-auto size-12"
              />
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {displayUsernameWithoutAt(person.username)}
              </p>
            </Link>
          ))}
          {overflow && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-16 shrink-0 text-center"
              aria-label={`See all ${people.length} ${title.toLowerCase()}`}
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-sm font-bold">
                +{people.length - shown.length}
              </span>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">See all</p>
            </button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          None yet.
        </p>
      )}
      <PeopleSheet title={title} people={people} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Everyone in a followers/following list, with Follow / Following buttons. */
function PeopleSheet({
  title,
  people,
  open,
  onOpenChange,
}: {
  title: string;
  people: FollowProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data: myFollowing } = useQuery({
    queryKey: ["following", user?.id],
    enabled: open && !!user,
    queryFn: () => fetchFollowing(user!.id),
  });
  const followingIds = new Set((myFollowing ?? []).map((p) => p.user_id));

  async function toggle(person: FollowProfile) {
    if (!user) {
      openAuthModal("Create a free account to follow people.");
      return;
    }
    setBusy(person.user_id);
    try {
      if (followingIds.has(person.user_id)) await unfollowProfile(user.id, person.user_id);
      else await followProfile(user.id, person.user_id);
      await queryClient.invalidateQueries({ queryKey: ["following", user.id] });
      void queryClient.invalidateQueries({ queryKey: ["social-counts"] });
      void queryClient.invalidateQueries({ queryKey: ["followers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {title} ({people.length})
          </DrawerTitle>
        </DrawerHeader>
        <ul className="overflow-y-auto px-4 pb-6">
          {people.map((person) => {
            const me = person.user_id === user?.id;
            const following = followingIds.has(person.user_id);
            return (
              <li key={person.user_id} className="flex items-center gap-3 py-2">
                <Link
                  to="/u/$username"
                  params={{ username: person.username }}
                  onClick={() => onOpenChange(false)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar
                    photoUrl={person.avatar_url}
                    fallback={person.username}
                    className="size-11"
                  />
                  <span className="truncate font-medium">
                    {displayUsernameWithoutAt(person.username)}
                  </span>
                </Link>
                {!me && (
                  <button
                    type="button"
                    disabled={busy === person.user_id}
                    onClick={() => void toggle(person)}
                    className={`min-h-9 shrink-0 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${
                      following ? "border border-input" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {following ? "Following" : "Follow"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

export function ProfileConnections({ userId }: { userId: string }) {
  const { data: followers = [] } = useQuery({
    queryKey: ["followers", userId],
    queryFn: () => fetchFollowers(userId),
  });
  const { data: following = [] } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => fetchFollowing(userId),
  });
  return (
    <div className="space-y-5">
      <PeopleRow title="Followers" people={followers} />
      <PeopleRow title="Following" people={following} />
    </div>
  );
}

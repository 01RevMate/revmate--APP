import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { fetchFollowers, fetchFollowing, fetchSocialCounts } from "@/lib/follows";
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
    [data?.cars ?? 0, "Cars"],
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

function PeopleRow({
  title,
  people,
}: {
  title: string;
  people: Awaited<ReturnType<typeof fetchFollowers>>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {people.length ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {people.slice(0, 12).map((person) => (
            <Link
              key={person.user_id}
              to="/u/$username"
              params={{ username: person.username }}
              className="w-16 shrink-0 text-center"
            >
              <Avatar
                photoUrl={person.avatar_url}
                fallback={person.username}
                className="mx-auto size-11"
              />
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {displayUsernameWithoutAt(person.username)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          None yet.
        </p>
      )}
    </div>
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

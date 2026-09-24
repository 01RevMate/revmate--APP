import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Heart, MessageCircle, TrendingUp, UserPlus, Users } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchAccountAnalytics } from "@/lib/follows";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Account analytics — RevMate" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const analytics = useQuery({
    queryKey: ["account-analytics", user?.id],
    queryFn: fetchAccountAnalytics,
    enabled: !!user,
  });

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <BarChart3 className="mx-auto size-9 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-bold">Account analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to see how your RevMate profile and posts are performing.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    );
  }

  const data = analytics.data;
  const cards = [
    {
      label: "Profile views",
      value: data?.profile_views_30d ?? 0,
      detail: `${data?.profile_views_7d ?? 0} in the last 7 days`,
      Icon: Eye,
    },
    {
      label: "Followers",
      value: data?.followers_total ?? 0,
      detail: `+${data?.new_followers_30d ?? 0} in the last 30 days`,
      Icon: Users,
    },
    {
      label: "Following",
      value: data?.following_total ?? 0,
      detail: "People whose posts you follow",
      Icon: UserPlus,
    },
    {
      label: "Posts",
      value: data?.posts_total ?? 0,
      detail: "Posts published from your profile",
      Icon: TrendingUp,
    },
    {
      label: "Likes received",
      value: data?.likes_received_30d ?? 0,
      detail: "Across your posts in 30 days",
      Icon: Heart,
    },
    {
      label: "Comments received",
      value: data?.comments_received_30d ?? 0,
      detail: "Across your posts in 30 days",
      Icon: MessageCircle,
    },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Your account</p>
              <h1 className="text-2xl font-bold tracking-tight">Account analytics</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Private performance figures for the last 30 days.
              </p>
            </div>
            {profile && (
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className="shrink-0 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-accent"
              >
                View profile
              </Link>
            )}
          </div>

          {analytics.isLoading && (
            <p className="mt-8 text-sm text-muted-foreground">Loading your figures…</p>
          )}
          {analytics.isError && (
            <p role="alert" className="mt-8 rounded-lg border border-destructive/30 p-4 text-sm">
              Could not load your analytics. Apply the followers and analytics SQL, then try again.
            </p>
          )}
          {data && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.map(({ label, value, detail, Icon }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <Icon className="size-5 text-primary" />
                  <p className="mt-4 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">How profile views work</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A signed-in person counts once per day when they visit your profile. Your own visits
              are never counted, and these figures are visible only to you.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

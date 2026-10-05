import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicProfile, PROFILE_PAGE } from "@/lib/publicProfiles";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BadgePoundSterling,
  CalendarDays,
  Clapperboard,
  Heart,
  MessageCircle,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { safeRedirect } from "@/lib/authRedirect";

// Signed-out visitors can browse the feed and Buy & Sell — enough to see
// what RevMate is — and everything else asks them to join. Account pages and
// the legal/help pages stay open.
const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/marketplace(\/[^/]+)?\/?$/,
  /^\/(login|signup|forgot-password|reset-password)\/?$/,
  /^\/legal\/.+/,
  /^\/community-standards\/?$/,
  /^\/businesses(\/[^/]+)?\/?$/,
  // Research, fixes, meets and the groups directory are useful to anyone and
  // help people find RevMate on Google.
  /^\/cars(\/.*)?$/,
  /^\/issues\/?$/,
  /^\/meets(\/[^/]+)?\/?$/,
  /^\/groups\/?$/,
  /^\/ev-chargers\/?$/,
  /^\/fuel-prices\/?$/,
];

// What people were trying to open, so the join screen can sell exactly that.
const PITCHES: { match: RegExp; title: string; pitch: string }[] = [
  {
    match: /^\/battles/,
    title: "Car Battles",
    pitch: "Vote on head-to-head car battles and help crown Car of the Week.",
  },
  {
    match: /^\/revs/,
    title: "Revs",
    pitch: "Swipe through exhausts, launches and walkarounds from real owners.",
  },
  {
    match: /^\/meets/,
    title: "Meets & events",
    pitch: "Find car meets near you, see who's going and get a reminder the day before.",
  },
  {
    match: /^\/u\//,
    title: "Owner profiles",
    pitch: "See people's garages, builds and posts — and follow the ones you like.",
  },
  {
    match: /^\/posts\//,
    title: "This post",
    pitch: "Read the full post and join the conversation.",
  },
  { match: /^\/tags\//, title: "Hashtags", pitch: "Browse every post with this tag." },
  {
    match: /^\/leaderboard/,
    title: "The leaderboard",
    pitch: "See the UK's top-rated cars and where yours would rank.",
  },
  { match: /^\/groups/, title: "Groups", pitch: "Join clubs and owners' groups for your car." },
  {
    match: /^\/(cars|ask)/,
    title: "Research & help",
    pitch: "Specs, common faults and answers from real owners.",
  },
  {
    match: /^\/essentials/,
    title: "Essentials",
    pitch: "Buying, selling, parts, help and research — everything practical in one place.",
  },
  {
    match: /^\/sell/,
    title: "Selling",
    pitch: "List your car or parts for free in a couple of minutes.",
  },
];

const PERKS = [
  { icon: Heart, text: "Like, comment and follow owners" },
  { icon: Swords, text: "Vote in Car Battles and climb the leaderboard" },
  { icon: Clapperboard, text: "Revs, stories and your own garage" },
  { icon: CalendarDays, text: "Car meets near you" },
  { icon: BadgePoundSterling, text: "Watch listings and get price-drop alerts" },
  { icon: MessageCircle, text: "Message buyers and sellers" },
];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

/** Shows the page if it's public or you're signed in; otherwise the join screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });

  if (user || isPublicPath(pathname)) return <>{children}</>;
  // Don't flash the join screen at people who are signed in while we check.
  if (loading) return <div className="min-h-[60vh]" />;
  const profileMatch = PROFILE_PAGE.exec(pathname);
  if (profileMatch) {
    return (
      <PublicProfileGate username={profileMatch[1]!} pathname={pathname} href={href}>
        {children}
      </PublicProfileGate>
    );
  }
  return <JoinWall pathname={pathname} redirect={safeRedirect(href)} />;
}

/** Adults' profiles and cars are public; everyone else's need an account. */
function PublicProfileGate({
  username,
  pathname,
  href,
  children,
}: {
  username: string;
  pathname: string;
  href: string;
  children: ReactNode;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", username.toLowerCase()],
    queryFn: () => fetchPublicProfile(username),
    staleTime: 5 * 60_000,
  });
  if (isLoading) return <div className="min-h-[60vh]" />;
  if (data?.status === "public") return <>{children}</>;
  return <JoinWall pathname={pathname} redirect={safeRedirect(href)} />;
}

function JoinWall({ pathname, redirect }: { pathname: string; redirect: string | undefined }) {
  const target = PITCHES.find((p) => p.match.test(pathname));
  const search = redirect ? { redirect } : {};
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <BrandLogo className="h-16 w-32" />
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
        {target ? `Join RevMate to see ${target.title}` : "Join RevMate to see this"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {target?.pitch ?? "It's free and takes less than a minute."}
      </p>
      <ul className="mt-6 grid w-full gap-2 text-left">
        {PERKS.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            {text}
          </li>
        ))}
      </ul>
      <Link
        to="/signup"
        search={search}
        className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
      >
        Create a free account
      </Link>
      <Link
        to="/login"
        search={search}
        className="mt-2 w-full rounded-full border border-input px-4 py-3 text-sm font-semibold hover:bg-accent"
      >
        I already have an account
      </Link>
      <div className="mt-5 flex gap-4 text-sm">
        <Link to="/" className="text-primary">
          <Users className="mr-1 inline size-4" />
          Browse the feed
        </Link>
        <Link to="/marketplace" className="text-primary">
          <Trophy className="mr-1 inline size-4" />
          Buy & Sell
        </Link>
      </div>
    </main>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Search, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { fetchGarage } from "@/lib/garage";
import { BrandLogo } from "@/components/BrandLogo";
import { PostingIdentitySwitcher } from "@/components/PostingIdentitySwitcher";
import { MobileMenu } from "@/components/MobileMenu";

const navLink = "text-sm text-muted-foreground transition-colors hover:text-foreground";
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

export function TopNav() {
  const hidden = useHideOnScroll();
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  // The auth pages already show their own logo and their own login/signup
  // links — a full bar here would just duplicate both, so swap it for a
  // plain back button instead of the logo/menu/sign-in row.
  if (AUTH_PATHS.has(pathname)) {
    return (
      <header className="border-b border-border">
        <nav className="flex items-center px-4 py-2 md:px-6 md:py-4">
          <Link
            to="/"
            aria-label="Back to RevMate"
            className={`flex items-center gap-1.5 ${navLink}`}
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header
      className={`sticky top-0 z-30 border-b border-border bg-background transition-transform duration-300 ease-out md:static md:translate-y-0 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <nav className="flex flex-wrap items-center gap-3 px-4 py-2 md:px-6 md:py-4">
        <Link to="/" aria-label="RevMate home" className="block">
          <BrandLogo className="h-8 w-auto" />
        </Link>
        <MobileMenu />
        {user && profile && (
          <div className="ml-auto flex items-center gap-3">
            {/* Not wired up yet — placeholder for notifications. */}
            <button
              aria-label="Notifications"
              title="Notifications"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Bell className="size-5" />
            </button>
            {/* Visual placeholder only — search will be connected later. */}
            <button
              type="button"
              aria-label="Search — coming soon"
              title="Search — coming soon"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Search className="size-5" />
            </button>
            <PostingIdentitySwitcher
              userId={user.id}
              username={profile.username}
              avatarUrl={profile.avatar_url}
              activeGarageCarId={profile.active_garage_car_id}
              cars={(garage ?? []).filter((car) => car.ownership_status !== "previous")}
              variant="avatar"
              onSignOut={handleSignOut}
            />
          </div>
        )}
        {!user && !loading && (
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/login"
              aria-label="Sign in"
              title="Sign in"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <UserRound className="size-5" />
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

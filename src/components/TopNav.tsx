import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { fetchGarage } from "@/lib/garage";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { PostingIdentitySwitcher } from "@/components/PostingIdentitySwitcher";
import { MobileMenu } from "@/components/MobileMenu";

const navLink = "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function TopNav() {
  const hidden = useHideOnScroll();
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
            <PostingIdentitySwitcher
              userId={user.id}
              username={profile.username}
              avatarUrl={profile.avatar_url}
              activeGarageCarId={profile.active_garage_car_id}
              cars={(garage ?? []).filter((car) => car.ownership_status !== "previous")}
              variant="avatar"
            />
            <Button onClick={handleSignOut} variant="ghost" size="sm" className={navLink}>
              Sign out
            </Button>
          </div>
        )}
        {!user && !loading && (
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign in
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

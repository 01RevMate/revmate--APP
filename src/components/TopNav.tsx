import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

const navLink = "text-sm text-muted-foreground transition-colors hover:text-foreground";

export function TopNav() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="border-b border-border">
      <nav className="flex flex-wrap items-center gap-4 px-4 py-4">
        <Link to="/" aria-label="RevMate home" className="block">
          <BrandLogo className="h-10 w-28" />
        </Link>
        {user && (
          <div className="ml-auto flex items-center gap-4">
            <Button onClick={handleSignOut} variant="ghost" size="sm" className={navLink}>
              Sign out
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
        <Link to="/" className="text-base font-semibold tracking-tight">
          RevMate
        </Link>
        {user && (
          <div className="ml-auto flex items-center gap-4">
            <button onClick={handleSignOut} className={navLink}>
              Sign out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}

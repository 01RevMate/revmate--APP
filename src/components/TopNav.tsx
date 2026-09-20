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
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4">
        <Link to="/" className="mr-2 text-base font-semibold tracking-tight">
          RevMate
        </Link>
        <Link to="/cars" className={navLink} activeProps={{ className: "text-sm text-foreground" }}>
          Browse Cars
        </Link>
        <Link to="/ask" className={navLink} activeProps={{ className: "text-sm text-foreground" }}>
          Ask
        </Link>
        <Link to="/sell" className={navLink} activeProps={{ className: "text-sm text-foreground" }}>
          Sell
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {user ? (
            <>
              <Link
                to="/profile"
                className={navLink}
                activeProps={{ className: "text-sm text-foreground" }}
              >
                Profile
              </Link>
              <button onClick={handleSignOut} className={navLink}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLink}>
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Home, Car, MessageCircleQuestion, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const item =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground";
const activeItem = "bg-accent text-foreground";

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 space-y-1 md:block">
      <Link to="/" className={item} activeOptions={{ exact: true }} activeProps={{ className: `${item} ${activeItem}` }}>
        <Home className="size-5" />
        Home
      </Link>
      <Link to="/cars" className={item} activeProps={{ className: `${item} ${activeItem}` }}>
        <Car className="size-5" />
        Browse Cars
      </Link>
      <Link to="/ask" className={item} activeProps={{ className: `${item} ${activeItem}` }}>
        <MessageCircleQuestion className="size-5" />
        Ask a Question
      </Link>
      <span className={`${item} cursor-not-allowed opacity-50 hover:bg-transparent`}>
        <Users className="size-5" />
        Groups
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      </span>
      {user && (
        <Link to="/profile" className={item} activeProps={{ className: `${item} ${activeItem}` }}>
          <User className="size-5" />
          My Garage
        </Link>
      )}
    </aside>
  );
}

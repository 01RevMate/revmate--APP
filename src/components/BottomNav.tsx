import { Link } from "@tanstack/react-router";
import { Home, Car, Warehouse, ShoppingBag, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const item =
  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeItem = "text-primary";

function NavItem({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  exact?: boolean;
}) {
  const linkProps = exact ? { activeOptions: { exact: true } } : {};
  return (
    <Link to={to} className={item} activeProps={{ className: `${item} ${activeItem}` }} {...linkProps}>
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

// Same destinations as the desktop Sidebar, trimmed to what fits a thumb-width
// row and shown on every page (the sidebar itself only appears on the feed).
export function BottomNav() {
  const { user } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <NavItem to="/" icon={Home} label="Home" exact />
      <NavItem to="/cars" icon={Car} label="Cars" />
      <NavItem to="/marketplace" icon={ShoppingBag} label="Marketplace" />
      {user && <NavItem to="/garage" icon={Warehouse} label="Garage" />}
      {user && <NavItem to="/messages" icon={MessageCircle} label="Messages" />}
    </nav>
  );
}

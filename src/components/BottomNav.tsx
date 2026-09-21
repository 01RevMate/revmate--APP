import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Car, Warehouse, ShoppingBag, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { CreatePostModal } from "@/components/CreatePostModal";

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

// A raised circular compose button breaking the row, inset above the bar —
// the same mechanic as the Wooble reference app's center FAB: elevated,
// distinct from the plain icon tabs either side of it.
function ComposeButton() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-1 items-center justify-center">
        <button
          onClick={() => (user ? setModalOpen(true) : openAuthModal("Create a free account to post to the feed."))}
          aria-label="New post"
          className="-mt-4 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {user && <CreatePostModal open={modalOpen} onOpenChange={setModalOpen} />}
    </>
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
      {!user && <NavItem to="/marketplace" icon={ShoppingBag} label="Marketplace" />}
      <ComposeButton />
      {user && <NavItem to="/marketplace" icon={ShoppingBag} label="Marketplace" />}
      {user && <NavItem to="/garage" icon={Warehouse} label="Garage" />}
      {user && <NavItem to="/messages" icon={MessageCircle} label="Messages" />}
    </nav>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Warehouse, MessageCircle, Plus, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { CreatePostModal } from "@/components/CreatePostModal";

const item =
  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground";
const activeItem = "text-primary";

function NavItem({
  to,
  icon: Icon,
  label,
  exact,
  requireAuth,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  exact?: boolean;
  requireAuth?: boolean;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const linkProps = exact ? { activeOptions: { exact: true } } : {};
  const blocked = requireAuth && !user;
  return (
    <Link
      to={to}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          openAuthModal(`Create a free account to use ${label}.`);
        }
      }}
      className={item}
      activeProps={{ className: `${item} ${activeItem}` }}
      {...linkProps}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

// A raised circular compose button breaking the row, inset above the bar —
// the same mechanic as the Wooble reference app's center FAB. It lives in
// its own fixed-width grid column (not a flex-1 column shared with a label)
// so it never overlaps a nav item's text regardless of how the other
// columns are split.
function ComposeButton() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="relative flex w-[62px] shrink-0 items-center justify-center">
      <button
        onClick={() => (user ? setModalOpen(true) : openAuthModal("Create a free account to post to the feed."))}
        aria-label="New post"
        className="absolute -top-2 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="size-7" />
      </button>
      {user && <CreatePostModal open={modalOpen} onOpenChange={setModalOpen} />}
    </div>
  );
}

// Trimmed to the 4 destinations that matter most on a thumb-width screen,
// split evenly (2 + 2) around the compose button so it lands in the gap
// between them — everything else (Cars, Settings, Groups) lives behind the
// hamburger menu next to the logo instead. Garage/Messages intercept the
// click and open the sign-in prompt instead of navigating when logged out.
export function BottomNav() {
  const hidden = useHideOnScroll();

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur transition-transform duration-300 ease-out supports-[backdrop-filter]:bg-card/80 md:hidden md:translate-y-0 ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-1">
        <NavItem to="/" icon={Home} label="Home" exact />
        <NavItem to="/marketplace" icon={ShoppingBag} label="Buy & Sell" />
      </div>
      <ComposeButton />
      <div className="flex flex-1">
        <NavItem to="/garage" icon={Warehouse} label="Garage" requireAuth />
        <NavItem to="/messages" icon={MessageCircle} label="Messages" requireAuth />
      </div>
    </nav>
  );
}

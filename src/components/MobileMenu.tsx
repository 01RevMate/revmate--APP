import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  Home,
  Car,
  ShoppingBag,
  Users,
  Warehouse,
  MessageCircle,
  Settings,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const item =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground";

function MenuLink({
  to,
  icon: Icon,
  label,
  requireAuth,
  onNavigate,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  requireAuth?: boolean;
  onNavigate: () => void;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const blocked = requireAuth && !user;
  return (
    <Link
      to={to}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          openAuthModal(`Create a free account to use ${label}.`);
          return;
        }
        onNavigate();
      }}
      className={item}
      activeProps={{ className: `${item} bg-accent text-foreground` }}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  );
}

// Everything the desktop Sidebar links to, but for mobile — the bottom nav
// only has room for Home/Garage/Messages plus the compose button, so the
// rest lives behind this hamburger next to the logo.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useProfile();

  function close() {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 space-y-1">
          <MenuLink to="/" icon={Home} label="Home" onNavigate={close} />
          <MenuLink to="/cars" icon={Car} label="Browse Cars" onNavigate={close} />
          <MenuLink to="/marketplace" icon={ShoppingBag} label="Buy & Sell" onNavigate={close} />
          <MenuLink to="/leaderboard" icon={Trophy} label="Leaderboard" onNavigate={close} />
          <MenuLink to="/groups" icon={Users} label="Groups" requireAuth onNavigate={close} />
          <MenuLink to="/ask" icon={MessageCircle} label="Ask for help" onNavigate={close} />
          <MenuLink
            to="/community-standards"
            icon={ShieldCheck}
            label="Community standards"
            onNavigate={close}
          />
          <MenuLink
            to="/garage"
            icon={Warehouse}
            label="My Garage"
            requireAuth
            onNavigate={close}
          />
          <MenuLink
            to="/messages"
            icon={MessageCircle}
            label="Messages"
            requireAuth
            onNavigate={close}
          />
          <MenuLink
            to="/settings"
            icon={Settings}
            label="Settings"
            requireAuth
            onNavigate={close}
          />
          {isAdmin && <MenuLink to="/admin" icon={ShieldCheck} label="Admin" onNavigate={close} />}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

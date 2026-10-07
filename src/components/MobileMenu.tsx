import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  Home,
  Stethoscope,
  Car,
  ShoppingBag,
  Users,
  Warehouse,
  MessageCircle,
  Settings,
  ShieldCheck,
  Trophy,
  CalendarDays,
  Clapperboard,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CountBadge } from "@/components/CountBadge";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const item =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground";

function MenuLink({
  to,
  icon: Icon,
  label,
  requireAuth,
  onNavigate,
  badge = 0,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  requireAuth?: boolean;
  onNavigate: () => void;
  badge?: number;
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
      <CountBadge count={badge} className="ml-auto" />
    </Link>
  );
}

// Everything the desktop Sidebar links to, but for mobile — the bottom nav
// only has room for Home/Garage/Messages plus the compose button, so the
// rest lives behind this hamburger next to the logo.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useProfile();
  const unread = useUnreadMessages();

  function close() {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label={unread > 0 ? `Open menu, ${unread} unread messages` : "Open menu"}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
        >
          <Menu className="size-5" />
          <CountBadge count={unread} className="absolute -right-1 -top-1" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 space-y-1">
          <MenuLink to="/" icon={Home} label="Home" onNavigate={close} />
          <MenuLink to="/cars" icon={Car} label="Browse Cars" onNavigate={close} />
          <MenuLink to="/essentials" icon={Wrench} label="Essentials" onNavigate={close} />
          <MenuLink to="/marketplace" icon={ShoppingBag} label="Buy & Sell" onNavigate={close} />
          <MenuLink to="/meets" icon={CalendarDays} label="Meets & Events" onNavigate={close} />
          <MenuLink to="/battles" icon={Trophy} label="Top cars" onNavigate={close} />
          <MenuLink to="/revs" icon={Clapperboard} label="Revs" onNavigate={close} />
          <MenuLink to="/groups" icon={Users} label="Groups" requireAuth onNavigate={close} />
          <MenuLink to="/ask" icon={Stethoscope} label="Ask for help" onNavigate={close} />
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
            badge={unread}
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
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Appearance
          </p>
          <ThemeSwitch />
        </div>
      </SheetContent>
    </Sheet>
  );
}

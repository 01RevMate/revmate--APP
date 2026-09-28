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
  CalendarDays,
  Swords,
  Clapperboard,
  MapPin,
  Wrench,
} from "lucide-react";
import { useEngagementFeatures, useSocialFeatures } from "@/lib/features";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CountBadge } from "@/components/CountBadge";
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
  const social = useSocialFeatures();
  const engagement = useEngagementFeatures();
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
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 space-y-1">
          <MenuLink to="/" icon={Home} label="Home" onNavigate={close} />
          <MenuLink to="/cars" icon={Car} label="Browse Cars" onNavigate={close} />
          <MenuLink to="/essentials" icon={Wrench} label="Essentials" onNavigate={close} />
          <MenuLink to="/marketplace" icon={ShoppingBag} label="Buy & Sell" onNavigate={close} />
          <MenuLink to="/leaderboard" icon={Trophy} label="Leaderboard" onNavigate={close} />
          {engagement && (
            <>
              <MenuLink to="/battles" icon={Swords} label="Car Battles" onNavigate={close} />
              <MenuLink to="/revs" icon={Clapperboard} label="Revs" onNavigate={close} />
              <MenuLink to="/near-you" icon={MapPin} label="Near you" onNavigate={close} />
            </>
          )}
          {social && (
            <MenuLink to="/meets" icon={CalendarDays} label="Meets & Events" onNavigate={close} />
          )}
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
      </SheetContent>
    </Sheet>
  );
}

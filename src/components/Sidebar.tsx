import { useEffect, useState } from "react";
import { CommunityChargerMark } from "@/components/CommunityChargerMark";
import { Link } from "@tanstack/react-router";
import { BATTLES_ENABLED } from "@/lib/features";
import {
  Home,
  Stethoscope,
  Car,
  Warehouse,
  Users,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  Settings,
  MessageCircle,
  Trophy,
  CalendarDays,
  Clapperboard,
  Wrench,
  Store,
  Building,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CountBadge } from "@/components/CountBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ShopNavLink } from "@/components/ShopNavLink";
import { shopNavTooltip } from "@/lib/shop";

const STORAGE_KEY = "revmate:sidebarCollapsed";

const item =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground";
const activeItem = "bg-accent text-foreground";

function NavLink({
  to,
  icon: Icon,
  label,
  collapsed,
  exact,
  requireAuth,
  badge = 0,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  collapsed: boolean;
  exact?: boolean;
  requireAuth?: boolean;
  badge?: number;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const linkProps = exact ? { activeOptions: { exact: true } } : {};
  const blocked = requireAuth && !user;
  if (collapsed) {
    return (
      <div className="rail-wrap">
        <Link
          to={to}
          aria-label={label}
          onClick={(e) => {
            if (blocked) {
              e.preventDefault();
              openAuthModal(`Create a free account to use ${label}.`);
            }
          }}
          className="rail-item"
          {...linkProps}
        >
          <Icon className="size-5 shrink-0" />
          <CountBadge count={badge} className="absolute -right-1.5 -top-1.5 z-10" />
        </Link>
        <span className="rail-tip" role="tooltip">
          {label}
        </span>
      </div>
    );
  }

  const link = (
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
      <span className="relative">
        <Icon className="size-5 shrink-0" />
      </span>
      {label}
      <CountBadge count={badge} className="ml-auto" />
    </Link>
  );

  return link;
}

export function Sidebar() {
  const { isAdmin } = useProfile();
  const unread = useUnreadMessages();
  // Desktop shows a slim icon rail by default; the toggle expands it to full labels.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) !== "0");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border bg-card/50 py-4 md:flex ${
        collapsed ? "w-20 px-3" : "w-60 px-3"
      }`}
    >
      <nav className={collapsed ? "space-y-2.5" : "space-y-1"}>
        <NavLink to="/" icon={Home} label="Home" collapsed={collapsed} exact />
        <NavLink to="/cars" icon={Car} label="Browse Cars" collapsed={collapsed} />
        <NavLink to="/essentials" icon={Wrench} label="Essentials" collapsed={collapsed} />
        <NavLink
          to="/ev-chargers/community"
          icon={CommunityChargerMark as unknown as typeof Home}
          label="Lendawatt"
          collapsed={collapsed}
        />
        <NavLink to="/marketplace" icon={Store} label="Buy & Sell" collapsed={collapsed} />
        {collapsed ? (
          <div className="rail-wrap">
            <ShopNavLink className="rail-item" showLabel={false} />
            <span className="rail-tip" role="tooltip">
              {shopNavTooltip()}
            </span>
          </div>
        ) : (
          <ShopNavLink className={item} activeClassName={`${item} ${activeItem}`} />
        )}
        <NavLink to="/meets" icon={CalendarDays} label="Meets & Events" collapsed={collapsed} />
        {BATTLES_ENABLED && (
          <NavLink to="/battles" icon={Trophy} label="Top cars" collapsed={collapsed} />
        )}
        {<NavLink to="/revs" icon={Clapperboard} label="Revs" collapsed={collapsed} />}
        <NavLink to="/groups" icon={Users} label="Groups" collapsed={collapsed} requireAuth />
        <NavLink to="/ask" icon={Stethoscope} label="Ask for help" collapsed={collapsed} />
        <NavLink
          to="/garage"
          icon={Warehouse}
          label="My Garage"
          collapsed={collapsed}
          requireAuth
        />
        <NavLink
          to="/messages"
          icon={MessageCircle}
          label="Messages"
          collapsed={collapsed}
          requireAuth
          badge={unread}
        />
        <NavLink
          to="/settings"
          icon={Settings}
          label="Settings"
          collapsed={collapsed}
          requireAuth
        />
        {isAdmin && <NavLink to="/admin" icon={ShieldCheck} label="Admin" collapsed={collapsed} />}
        <NavLink
          to="/businesses/manage"
          icon={Building}
          label="My business"
          collapsed={collapsed}
        />
      </nav>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggle}
            className="mt-auto flex items-center justify-center self-end rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeft className="size-5 shrink-0" />
            ) : (
              <PanelLeftClose className="size-5 shrink-0" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  Car,
  Warehouse,
  Users,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  ShoppingBag,
  Settings,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const STORAGE_KEY = "revmate:sidebarCollapsed";

const item =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground";
const itemCollapsed = "justify-center px-2";
const activeItem = "bg-accent text-foreground";

function NavLink({
  to,
  icon: Icon,
  label,
  collapsed,
  exact,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  collapsed: boolean;
  exact?: boolean;
}) {
  const linkProps = exact ? { activeOptions: { exact: true } } : {};
  const link = (
    <Link
      to={to}
      className={`${item} ${collapsed ? itemCollapsed : ""}`}
      activeProps={{ className: `${item} ${collapsed ? itemCollapsed : ""} ${activeItem}` }}
      {...linkProps}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && label}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function GroupsItem({ collapsed }: { collapsed: boolean }) {
  const span = (
    <span
      className={`${item} ${collapsed ? itemCollapsed : ""} cursor-not-allowed opacity-50 hover:bg-transparent`}
    >
      <Users className="size-5 shrink-0" />
      {!collapsed && (
        <>
          Groups
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        </>
      )}
    </span>
  );

  if (!collapsed) return span;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{span}</TooltipTrigger>
      <TooltipContent side="right">Groups — coming soon</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
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
      className={`sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-border bg-card/50 py-4 md:flex ${
        collapsed ? "w-16 px-2" : "w-60 px-3"
      }`}
    >
      <nav className="space-y-1">
        <NavLink to="/" icon={Home} label="Home" collapsed={collapsed} exact />
        <NavLink to="/cars" icon={Car} label="Browse Cars" collapsed={collapsed} />
        <NavLink to="/marketplace" icon={ShoppingBag} label="Buy & Sell" collapsed={collapsed} />
        <GroupsItem collapsed={collapsed} />
        {user && <NavLink to="/garage" icon={Warehouse} label="My Garage" collapsed={collapsed} />}
        {user && <NavLink to="/messages" icon={MessageCircle} label="Messages" collapsed={collapsed} />}
        {user && <NavLink to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />}
        {isAdmin && <NavLink to="/admin" icon={ShieldCheck} label="Admin" collapsed={collapsed} />}
      </nav>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggle}
            className="flex items-center justify-center self-end rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="size-5 shrink-0" /> : <PanelLeftClose className="size-5 shrink-0" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
      </Tooltip>
    </aside>
  );
}

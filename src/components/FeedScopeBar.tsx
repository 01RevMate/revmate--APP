import { Car, Bookmark, Users, UserRoundCheck, Flame, Globe } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SlidingTabBar } from "@/components/SlidingTabBar";

export type FeedScope = "my_car" | "same_brand" | "friends" | "my_groups" | "popular" | "all";

const SCOPES: { id: FeedScope; label: string; icon: typeof Car }[] = [
  { id: "my_car", label: "My Car", icon: Car },
  { id: "same_brand", label: "Same Brand", icon: Bookmark },
  { id: "friends", label: "Friends", icon: UserRoundCheck },
  { id: "my_groups", label: "My Groups", icon: Users },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "all", label: "All Cars", icon: Globe },
];

export function FeedScopeBar({
  scope,
  onScopeChange,
  hasGarageCars,
  isAuthenticated,
}: {
  scope: FeedScope;
  onScopeChange: (scope: FeedScope) => void;
  hasGarageCars: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <SlidingTabBar activeId={scope} gliderClassName="bg-black">
      {(registerRef) =>
        SCOPES.map(({ id, label, icon: Icon }) => {
          const active = scope === id;
          const disabled =
            id === "friends"
              ? !isAuthenticated
              : id === "my_car" || id === "same_brand"
                ? !hasGarageCars
                : false;
          const button = (
            <button
              key={id}
              ref={registerRef(id)}
              onClick={() => !disabled && onScopeChange(id)}
              disabled={disabled}
              className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-transparent text-white"
                  : disabled
                    ? "cursor-not-allowed border-border bg-white text-slate-400"
                    : "border-border bg-white text-slate-900 hover:border-slate-400"
              }`}
            >
              <Icon className="size-3" />
              {label}
            </button>
          );

          if (!disabled) return button;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent>
                {id === "friends"
                  ? "Sign in to view your friends feed"
                  : "Add a car to your garage to unlock this"}
              </TooltipContent>
            </Tooltip>
          );
        })
      }
    </SlidingTabBar>
  );
}

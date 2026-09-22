import { Car, Bookmark, Users, Flame, Globe } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SlidingTabBar } from "@/components/SlidingTabBar";

export type FeedScope = "my_car" | "same_brand" | "my_groups" | "popular" | "all";

const SCOPES: { id: FeedScope; label: string; icon: typeof Car }[] = [
  { id: "my_car", label: "My Car", icon: Car },
  { id: "same_brand", label: "Same Brand", icon: Bookmark },
  { id: "my_groups", label: "My Groups", icon: Users },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "all", label: "All Cars", icon: Globe },
];

export function FeedScopeBar({
  scope,
  onScopeChange,
  hasGarageCars,
}: {
  scope: FeedScope;
  onScopeChange: (scope: FeedScope) => void;
  hasGarageCars: boolean;
}) {
  return (
    <SlidingTabBar activeId={scope} gliderClassName="bg-primary">
      {(registerRef) =>
        SCOPES.map(({ id, label, icon: Icon }) => {
          const active = scope === id;
          const disabled = id === "my_car" || id === "same_brand" ? !hasGarageCars : false;
          const button = (
            <button
              key={id}
              ref={registerRef(id)}
              onClick={() => !disabled && onScopeChange(id)}
              disabled={disabled}
              className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "text-primary-foreground"
                  : disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
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
              <TooltipContent>Add a car to your garage to unlock this</TooltipContent>
            </Tooltip>
          );
        })
      }
    </SlidingTabBar>
  );
}

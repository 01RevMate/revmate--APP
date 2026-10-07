import { Car, Bookmark, Users, UserRoundCheck, Flame, Globe, Sparkles } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SlidingTabBar } from "@/components/SlidingTabBar";

export type FeedScope =
  "for_you" | "my_car" | "same_brand" | "friends" | "my_groups" | "popular" | "all";

const SCOPES: { id: FeedScope; label: string; icon: typeof Car }[] = [
  { id: "for_you", label: "For You", icon: Sparkles },
  { id: "my_car", label: "My Car", icon: Car },
  { id: "same_brand", label: "Same Brand", icon: Bookmark },
  { id: "friends", label: "Following", icon: UserRoundCheck },
  { id: "my_groups", label: "My Groups", icon: Users },
  { id: "popular", label: "Popular", icon: Flame },
  { id: "all", label: "All Cars", icon: Globe },
];

export function FeedScopeBar({
  scope,
  onScopeChange,
  hasGarageCars,
  isAuthenticated,
  showForYou = false,
}: {
  scope: FeedScope;
  onScopeChange: (scope: FeedScope) => void;
  hasGarageCars: boolean;
  isAuthenticated: boolean;
  showForYou?: boolean;
}) {
  return (
    <SlidingTabBar activeId={scope} gliderClassName="bg-foreground">
      {(registerRef) =>
        SCOPES.filter(({ id }) => showForYou || id !== "for_you").map(
          ({ id, label, icon: Icon }) => {
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
                    ? "border-transparent text-background"
                    : disabled
                      ? "cursor-not-allowed border-border bg-card text-muted-foreground/60"
                      : "border-border bg-card text-foreground hover:border-foreground/40"
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
                    ? "Sign in to view posts from people you follow"
                    : "Add a car to your garage to unlock this"}
                </TooltipContent>
              </Tooltip>
            );
          },
        )
      }
    </SlidingTabBar>
  );
}

import { Car, Bookmark, Users, Flame, Globe } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
    <div className="flex gap-2 overflow-x-auto pb-1">
      {SCOPES.map(({ id, label, icon: Icon }) => {
        const active = scope === id;
        const disabled = (id === "my_car" || id === "same_brand") ? !hasGarageCars : id === "my_groups";
        const button = (
          <button
            key={id}
            onClick={() => !disabled && onScopeChange(id)}
            disabled={disabled}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : disabled
                  ? "cursor-not-allowed bg-muted text-muted-foreground/40"
                  : "bg-muted text-muted-foreground hover:text-foreground"
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
              {id === "my_groups" ? "Groups — coming soon" : "Add a car to your garage to unlock this"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

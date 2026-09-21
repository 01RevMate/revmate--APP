import { POST_CATEGORY_LABELS, type Post } from "@/lib/posts";
import { SlidingTabBar } from "@/components/SlidingTabBar";

export type CategoryFilter = Post["category"] | "all";

export function CategoryFilterBar({
  category,
  onCategoryChange,
}: {
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}) {
  return (
    <SlidingTabBar activeId={category} gliderClassName="bg-accent">
      {(registerRef) => (
        <>
          <button
            ref={registerRef("all")}
            onClick={() => onCategoryChange("all")}
            className={`relative z-10 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {Object.entries(POST_CATEGORY_LABELS).map(([id, label]) => (
            <button
              key={id}
              ref={registerRef(id)}
              onClick={() => onCategoryChange(id as Post["category"])}
              className={`relative z-10 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </>
      )}
    </SlidingTabBar>
  );
}

import { POST_CATEGORY_LABELS, type Post } from "@/lib/posts";

export type CategoryFilter = Post["category"] | "all";

export function CategoryFilterBar({
  category,
  onCategoryChange,
}: {
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onCategoryChange("all")}
        className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          category === "all" ? "text-foreground underline" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      {Object.entries(POST_CATEGORY_LABELS).map(([id, label]) => (
        <button
          key={id}
          onClick={() => onCategoryChange(id as Post["category"])}
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            category === id ? "text-foreground underline" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

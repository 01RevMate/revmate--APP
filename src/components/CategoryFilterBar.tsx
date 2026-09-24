import { POST_CATEGORY_LABELS, type Post } from "@/lib/posts";
import { SlidingTabBar } from "@/components/SlidingTabBar";
import {
  LayoutGrid,
  MessagesSquare,
  Stethoscope,
  Wrench,
  Paintbrush,
  Gauge,
  Sparkles,
  Tag,
} from "lucide-react";

export type CategoryFilter = Post["category"] | "all";

const CATEGORY_ICONS = {
  discussion: MessagesSquare,
  diagnostics: Stethoscope,
  modifications: Wrench,
  bodywork: Paintbrush,
  maintenance: Gauge,
  showcase: Sparkles,
  for_sale: Tag,
} satisfies Record<Post["category"], typeof MessagesSquare>;

export function CategoryFilterBar({
  category,
  onCategoryChange,
}: {
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}) {
  return (
    <SlidingTabBar activeId={category} gliderClassName="bg-black">
      {(registerRef) => (
        <>
          <button
            ref={registerRef("all")}
            onClick={() => onCategoryChange("all")}
            className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              category === "all"
                ? "border-transparent text-white"
                : "border-border bg-white text-slate-900 hover:border-slate-400"
            }`}
          >
            <LayoutGrid className="size-3" />
            All
          </button>
          {Object.entries(POST_CATEGORY_LABELS).map(([id, label]) => {
            const Icon = CATEGORY_ICONS[id as Post["category"]];
            return (
              <button
                key={id}
                ref={registerRef(id)}
                onClick={() => onCategoryChange(id as Post["category"])}
                className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === id
                    ? "border-transparent text-white"
                    : "border-border bg-white text-slate-900 hover:border-slate-400"
                }`}
              >
                <Icon className="size-3" />
                {label}
              </button>
            );
          })}
        </>
      )}
    </SlidingTabBar>
  );
}

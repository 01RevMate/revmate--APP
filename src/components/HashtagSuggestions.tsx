import { useQuery } from "@tanstack/react-query";
import { Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Starter tags so suggestions work from day one (and before the trending
// SQL has run); real trending tags are shown first when there are any.
const STARTER_TAGS = [
  "carmeet",
  "projectcar",
  "stancesunday",
  "jdm",
  "euro",
  "ev",
  "detailing",
  "trackday",
  "restoration",
  "daily",
  "modified",
  "classiccar",
  "diagnostics",
  "carspotting",
  "newcar",
  "roadtrip",
];

/** The "#partial" being typed right before the caret, if any ("" right after #). */
export function activeHashtagQuery(text: string, caret: number): string | null {
  const match = /(^|[^A-Za-z0-9_&])#([A-Za-z0-9_]{0,39})$/.exec(text.slice(0, caret));
  return match ? match[2]! : null;
}

/** Replace the "#partial" before the caret with the chosen tag. */
export function insertHashtag(text: string, caret: number, tag: string) {
  const before = text.slice(0, caret).replace(/#([A-Za-z0-9_]{0,39})$/, `#${tag} `);
  return { text: before + text.slice(caret), caret: before.length };
}

async function fetchTagSuggestions(prefix: string): Promise<{ tag: string; uses: number }[]> {
  const { data, error } = await supabase.rpc("trending_hashtags", { prefix, result_limit: 8 });
  const trending = error ? [] : data.map((row) => ({ tag: row.tag, uses: Number(row.uses) }));
  const starters = STARTER_TAGS.filter(
    (tag) => tag.startsWith(prefix.toLowerCase()) && !trending.some((t) => t.tag === tag),
  ).map((tag) => ({ tag, uses: 0 }));
  return [...trending, ...starters].slice(0, 8);
}

/** TikTok-style list of popular hashtags while someone types a #tag. */
export function HashtagSuggestions({
  query,
  onPick,
}: {
  query: string | null;
  onPick: (tag: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["hashtag-suggestions", query?.toLowerCase()],
    queryFn: () => fetchTagSuggestions(query ?? ""),
    enabled: query !== null,
    staleTime: 60_000,
  });
  if (query === null || !data || data.length === 0) return null;
  return (
    <ul
      role="listbox"
      aria-label="Popular hashtags"
      className="overflow-hidden rounded-md border border-border bg-popover shadow-md"
    >
      {data.map(({ tag, uses }) => (
        <li key={tag}>
          <button
            type="button"
            // mousedown keeps focus (and the caret) in the text box
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(tag);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Hash className="size-3.5" />
            </span>
            <span className="flex-1 font-medium">#{tag}</span>
            {uses > 0 && (
              <span className="text-xs text-muted-foreground">
                {uses} {uses === 1 ? "post" : "posts"}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

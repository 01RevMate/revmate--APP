import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { searchMentionableProfiles } from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

/** The "@partial" being typed right before the caret, if any. */
export function activeMentionQuery(text: string, caret: number): string | null {
  const match = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_.]{1,30})$/.exec(text.slice(0, caret));
  return match ? match[2]! : null;
}

/** Replace the "@partial" before the caret with the chosen handle. */
export function insertMention(text: string, caret: number, handle: string) {
  const before = text.slice(0, caret).replace(/@([A-Za-z0-9_.]{1,30})$/, `@${handle} `);
  return { text: before + text.slice(caret), caret: before.length };
}

/** Dropdown of matching profiles while someone types an @mention. */
export function MentionSuggestions({
  query,
  onPick,
}: {
  query: string | null;
  onPick: (handle: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["mention-search", query],
    queryFn: () => searchMentionableProfiles(query!),
    enabled: !!query,
    staleTime: 30_000,
  });
  if (!query || !data || data.length === 0) return null;
  return (
    <ul
      role="listbox"
      aria-label="Mention someone"
      className="overflow-hidden rounded-md border border-border bg-popover shadow-md"
    >
      {data.map((profile) => {
        const handle = displayUsernameWithoutAt(profile.username);
        return (
          <li key={profile.user_id}>
            <button
              type="button"
              // mousedown keeps focus (and the caret) in the text box
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(handle);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <Avatar photoUrl={profile.avatar_url} fallback={handle} className="size-6" />@{handle}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

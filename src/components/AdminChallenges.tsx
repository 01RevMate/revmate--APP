import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createChallenge,
  deleteChallenge,
  fetchChallenges,
  setChallengeWinner,
  type Challenge,
} from "@/lib/engagement";
import { fetchPostsByTag } from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

// Ready-made ideas so a new challenge is two taps away.
const IDEAS = [
  {
    tag: "stancesunday",
    title: "Stance Sunday",
    description: "Show us your lowest, best-fitted stance.",
  },
  {
    tag: "cleancarfriday",
    title: "Clean Car Friday",
    description: "Fresh wash, fresh wax — post the shine.",
  },
  {
    tag: "throwbackthursday",
    title: "Throwback Thursday",
    description: "Your old cars and first builds.",
  },
  { tag: "nightshots", title: "Night Shots", description: "Best photo of your car after dark." },
];

/** Admin: run weekly challenges and pick winners (the winner is notified). */
export function AdminChallenges({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const inAWeek = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(inAWeek);
  const [saving, setSaving] = useState(false);
  const [judging, setJudging] = useState<Challenge | null>(null);

  const { data: challenges } = useQuery({
    queryKey: ["admin", "challenges"],
    queryFn: fetchChallenges,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "challenges"] });
    queryClient.invalidateQueries({ queryKey: ["active-challenge"] });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createChallenge({ userId, tag, title, description, startsOn, endsOn });
      toast.success(`#${tag.replace(/^#/, "").toLowerCase()} is set up`);
      setTag("");
      setTitle("");
      setDescription("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the challenge");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Weekly challenges</h2>
      <p className="text-sm text-muted-foreground">
        The current challenge shows as a banner on everyone's feed. People enter by posting with the
        hashtag.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea.tag}
            type="button"
            onClick={() => {
              setTag(idea.tag);
              setTitle(idea.title);
              setDescription(idea.description);
            }}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
          >
            #{idea.tag}
          </button>
        ))}
      </div>

      <form onSubmit={handleCreate} className="mt-3 space-y-2 rounded-lg border border-border p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            required
            placeholder="Hashtag, e.g. stancesunday"
            pattern="#?[A-Za-z][A-Za-z0-9_]{1,39}"
            className={input}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={100}
            placeholder="Title"
            className={input}
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="What should people post?"
          className={`${input} resize-none`}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium">
            Starts
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              required
              className={`${input} mt-1`}
            />
          </label>
          <label className="text-xs font-medium">
            Ends
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              required
              className={`${input} mt-1`}
            />
          </label>
        </div>
        <button
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Start challenge"}
        </button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {challenges?.map((challenge) => (
          <li key={challenge.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {challenge.title} <span className="text-muted-foreground">#{challenge.tag}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(challenge.starts_on), "d MMM")} –{" "}
                {format(parseISO(challenge.ends_on), "d MMM yyyy")}
                {challenge.winner_post_id && " · winner picked"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJudging(challenge)}
              className="flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Crown className="size-3.5" /> Pick winner
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete #${challenge.tag}?`)) return;
                await deleteChallenge(challenge.id).catch((err) => toast.error(err.message));
                refresh();
              }}
              aria-label="Delete challenge"
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {challenges?.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">No challenges yet.</li>
        )}
      </ul>

      {judging && (
        <WinnerPicker
          challenge={judging}
          onDone={() => {
            setJudging(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function WinnerPicker({ challenge, onDone }: { challenge: Challenge; onDone: () => void }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["posts-by-tag", challenge.tag],
    queryFn: () => fetchPostsByTag(challenge.tag),
  });
  const ranked = (entries ?? []).slice().sort((a, b) => b.likes_count - a.likes_count);

  async function pick(postId: string) {
    try {
      await setChallengeWinner(challenge.id, postId);
      toast.success("Winner picked — they've been notified");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set the winner");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Entries for #{challenge.tag} (most liked first)</h3>
        <button type="button" onClick={onDone} className="text-xs text-muted-foreground">
          Close
        </button>
      </div>
      {isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
      <ul className="mt-2 space-y-2">
        {ranked.map((post) => (
          <li key={post.id} className="flex items-center gap-3 rounded-md border border-border p-2">
            {post.post_images[0] && (
              <img
                src={post.post_images[0].image_url}
                alt=""
                className="size-12 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <Link
                to="/posts/$postId"
                params={{ postId: post.id }}
                className="line-clamp-1 text-sm hover:underline"
              >
                {post.body}
              </Link>
              <p className="text-xs text-muted-foreground">
                {displayUsernameWithoutAt(post.profiles?.username)} · {post.likes_count} likes
              </p>
            </div>
            <button
              type="button"
              onClick={() => void pick(post.id)}
              disabled={challenge.winner_post_id === post.id}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {challenge.winner_post_id === post.id ? "Winner" : "Pick"}
            </button>
          </li>
        ))}
        {!isLoading && ranked.length === 0 && (
          <li className="text-sm text-muted-foreground">No entries yet.</li>
        )}
      </ul>
    </div>
  );
}

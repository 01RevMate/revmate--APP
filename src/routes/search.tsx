import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Hash, Loader2, Search, Star, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import { PostCard } from "@/components/PostCard";
import { fetchMyLikedPostIds } from "@/lib/posts";
import { formatPrice } from "@/lib/marketplace";
import { searchEverything } from "@/lib/search";
import { displayUsername, displayUsernameWithoutAt } from "@/lib/usernames";
import { BUSINESS_CATEGORY_LABELS } from "@/lib/businesses";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] ? { q: search["q"].slice(0, 100) } : {},
  head: () => ({
    meta: [{ title: "Search — RevMate" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: SearchPage,
});

type Tab = "all" | "people" | "cars" | "posts" | "listings" | "groups" | "tags" | "businesses";

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { user } = useAuth();
  const [text, setText] = useState(q);
  const [tab, setTab] = useState<Tab>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Update the address (and the results) shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() !== q)
        void navigate({ search: text.trim() ? { q: text.trim() } : {}, replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, q, navigate]);
  useEffect(() => inputRef.current?.focus(), []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchEverything(q),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
  const { data: likedIds } = useQuery({
    queryKey: ["search", "liked", user?.id, data?.posts.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        data!.posts.map((p) => p.id),
      ),
    enabled: !!user && !!data?.posts.length,
  });

  const counts: Record<Exclude<Tab, "all">, number> = {
    people: data?.people.length ?? 0,
    cars: data?.cars.length ?? 0,
    posts: data?.posts.length ?? 0,
    listings: data?.listings.length ?? 0,
    groups: data?.groups.length ?? 0,
    tags: data?.tags.length ?? 0,
    businesses: data?.businesses.length ?? 0,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const show = (t: Exclude<Tab, "all">) => (tab === "all" || tab === t) && counts[t] > 0;
  const labels: Record<Exclude<Tab, "all">, string> = {
    people: "People",
    cars: "Cars",
    posts: "Posts",
    listings: "For sale",
    groups: "Groups",
    tags: "Hashtags",
    businesses: "Businesses",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ search: text.trim() ? { q: text.trim() } : {}, replace: true });
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search people, cars, posts, #tags, listings…"
          aria-label="Search RevMate"
          enterKeyHint="search"
          className="w-full rounded-full border border-input bg-background py-3 pl-10 pr-10 text-sm"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </form>

      {q.length >= 2 && data && (
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
          {(["all", ...(Object.keys(labels) as Exclude<Tab, "all">[])] as Tab[])
            .filter((t) => t === "all" || counts[t as Exclude<Tab, "all">] > 0)
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {t === "all"
                  ? `All (${total})`
                  : `${labels[t as Exclude<Tab, "all">]} (${counts[t as Exclude<Tab, "all">]})`}
              </button>
            ))}
        </div>
      )}

      {q.length < 2 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Type at least two letters. Try a car like "Golf R", a username, or a #tag.
        </p>
      )}
      {q.length >= 2 && data && total === 0 && !isFetching && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Nothing found for "{q}".</p>
      )}

      <div className="mt-4 space-y-6">
        {show("people") && (
          <Section title="People">
            {data!.people.map((p) => (
              <Link
                key={p.user_id}
                to="/u/$username"
                params={{ username: displayUsernameWithoutAt(p.username) }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <Avatar photoUrl={p.avatar_url} fallback={p.username} className="size-10" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{displayUsername(p.username)}</span>
                  {p.bio && (
                    <span className="block truncate text-xs text-muted-foreground">{p.bio}</span>
                  )}
                </span>
              </Link>
            ))}
          </Section>
        )}
        {show("tags") && (
          <Section title="Hashtags">
            <div className="flex flex-wrap gap-2">
              {data!.tags.map((t) => (
                <Link
                  key={t.tag}
                  to="/tags/$tag"
                  params={{ tag: t.tag }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                >
                  <Hash className="size-3.5" />
                  {t.tag}
                  <span className="text-xs text-muted-foreground">· {t.uses}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}
        {show("cars") && (
          <Section title="Cars">
            {data!.cars.map((c) => (
              <Link
                key={c.id}
                to="/u/$username/cars/$carId"
                params={{ username: displayUsernameWithoutAt(c.profiles?.username), carId: c.id }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <Avatar photoUrl={c.photo_url} fallback={c.nickname} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{c.nickname}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[c.year, c.make, c.model].filter(Boolean).join(" ")} ·{" "}
                    {displayUsername(c.profiles?.username)}
                  </span>
                </span>
                <CarLogo make={c.make} className="size-6" />
              </Link>
            ))}
          </Section>
        )}
        {show("listings") && (
          <Section title="For sale">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data!.listings.map((l) => (
                <Link
                  key={l.id}
                  to="/marketplace/$listingId"
                  params={{ listingId: l.id }}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="aspect-[4/3] bg-muted">
                    {l.photos?.[0] && (
                      <img
                        src={l.photos[0]}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <p className="px-2 pt-1 text-sm font-extrabold">{formatPrice(l.price)}</p>
                  <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{l.title}</p>
                </Link>
              ))}
            </div>
          </Section>
        )}
        {show("groups") && (
          <Section title="Groups">
            {data!.groups.map((g) => (
              <Link
                key={g.id}
                to="/groups/$slug"
                params={{ slug: g.slug }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {g.make_name ? (
                    <CarLogo make={g.make_name} className="size-7" />
                  ) : (
                    <Users className="size-5" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{g.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {g.member_count} {g.member_count === 1 ? "member" : "members"}
                  </span>
                </span>
              </Link>
            ))}
          </Section>
        )}
        {show("businesses") && (
          <Section title="Businesses">
            {data!.businesses.map((b) => (
              <Link
                key={b.id}
                to="/businesses/$businessId"
                params={{ businessId: b.id }}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {b.name}
                    {b.verified && <BadgeCheck className="size-4 text-primary" />}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
                    {b.town ? ` · ${b.town}` : ""}
                  </span>
                </span>
                {b.reviews_count > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    <Star className="size-3.5 text-amber-500" fill="currentColor" />
                    {Number(b.rating_avg).toFixed(1)} ({b.reviews_count})
                  </span>
                )}
              </Link>
            ))}
          </Section>
        )}
        {show("posts") && (
          <Section title="Posts">
            <div className="space-y-4">
              {data!.posts.map((post) => (
                <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

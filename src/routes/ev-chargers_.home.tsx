import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, Loader2, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import {
  HOME_CHARGERS,
  HOME_CHARGER_FAQ,
  fetchHomeChargerReviews,
  saveHomeChargerReview,
  type HomeCharger,
  type HomeChargerReview,
} from "@/lib/homeChargers";

const URL = "https://revmate.co.uk/ev-chargers/home";
const TITLE = "Best home EV chargers UK — prices and owner opinions | RevMate";
const DESC =
  "Compare popular UK home EV chargers (Ohme, zappi, Hypervolt, Pod Point, Easee, Andersen, Wallbox, Tesla): power, rough fitted prices, pros, cons and what drivers think.";

export const Route = createFileRoute("/ev-chargers_/home")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Home EV chargers — what drivers think | RevMate" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Popular UK home EV chargers",
          itemListElement: HOME_CHARGERS.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `${c.maker} ${c.name}`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "EV chargers", item: "https://revmate.co.uk/ev-chargers" },
            { "@type": "ListItem", position: 2, name: "Home chargers", item: URL },
          ],
        }),
      },
    ],
  }),
  component: HomeChargersPage,
});

function HomeChargersPage() {
  const reviews = useQuery({ queryKey: ["home-charger-reviews"], queryFn: fetchHomeChargerReviews });
  const all = reviews.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <Link
        to="/ev-chargers"
        className="-ml-1 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> EV chargers
      </Link>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Home EV chargers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The popular UK options and what drivers think of them. Just information — we don't sell
        chargers. Prices are rough guides, so always get a quote.
      </p>

      <div className="mt-4 space-y-3">
        {HOME_CHARGERS.map((c) => (
          <ChargerCard
            key={c.slug}
            charger={c}
            reviews={all.filter((r) => r.charger_slug === c.slug)}
            loading={reviews.isLoading}
          />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">Good to know</h2>
      <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
        {HOME_CHARGER_FAQ.map((f) => (
          <details key={f.q} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
              {f.q}
              <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 pb-6 text-xs text-muted-foreground">
        Summaries reflect common owner feedback and are general guides, not recommendations.
        Ratings come from RevMate members.
      </p>
    </main>
  );
}

function Stars({ value, size = "size-3.5" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function ChargerCard({
  charger: c,
  reviews,
  loading,
}: {
  charger: HomeCharger;
  reviews: HomeChargerReview[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <article className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">
            {c.maker} {c.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {c.power} · {c.priceGuide}
          </p>
          <p className="mt-1 text-sm">{c.bestFor}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : reviews.length ? (
              <>
                <Stars value={avg} />
                {avg.toFixed(1)} · {reviews.length} member {reviews.length === 1 ? "rating" : "ratings"}
              </>
            ) : (
              "No member ratings yet"
            )}
          </div>
        </div>
        <ChevronDown className={`mt-1 size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 pb-4 pt-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {c.cable} · Made in {c.madeIn}
          </p>
          <ul className="space-y-1">
            {c.likes.map((l) => (
              <li key={l} className="flex gap-2">
                <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-primary" /> {l}
              </li>
            ))}
            {c.watchOuts.map((l) => (
              <li key={l} className="flex gap-2">
                <ThumbsDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {l}
              </li>
            ))}
          </ul>

          <div>
            <h3 className="text-sm font-semibold">What members say</h3>
            {reviews.length === 0 && (
              <p className="text-xs text-muted-foreground">Have one? Be the first to rate it.</p>
            )}
            <ul className="mt-1 space-y-2">
              {reviews.slice(0, 5).map((r) => (
                <li key={r.id} className="rounded-xl bg-muted px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Stars value={r.rating} size="size-3" />
                    {r.username ? (
                      <Link
                        to="/u/$username"
                        params={{ username: r.username }}
                        className="font-semibold"
                      >
                        {r.username}
                      </Link>
                    ) : (
                      <span className="font-semibold">Member</span>
                    )}
                  </div>
                  {r.body && <p className="mt-1 text-sm">{r.body}</p>}
                </li>
              ))}
            </ul>
          </div>
          <RateForm slug={c.slug} existing={reviews} />
        </div>
      )}
    </article>
  );
}

function RateForm({ slug, existing }: { slug: string; existing: HomeChargerReview[] }) {
  const { user } = useAuth();
  const { open: openAuth } = useAuthModal();
  const mine = user ? existing.find((r) => r.user_id === user.id) : undefined;
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuth("Create a free account to rate your home charger.")}
        className="min-h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      >
        Got this charger? Rate it
      </button>
    );
  }

  async function submit() {
    if (!user || rating < 1) return;
    setSaving(true);
    try {
      await saveHomeChargerReview(user.id, slug, rating, body);
      await qc.invalidateQueries({ queryKey: ["home-charger-reviews"] });
      toast.success("Thanks — your rating is saved");
    } catch {
      toast.error("Couldn't save your rating. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold">{mine ? "Your rating" : "Own this charger? Rate it"}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star
              className={`size-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 600))}
        rows={2}
        placeholder="How's it been? Install, app, reliability…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={saving || rating < 1}
        className="min-h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Saving…" : mine ? "Update rating" : "Post rating"}
      </button>
    </div>
  );
}

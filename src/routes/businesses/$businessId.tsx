import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { BadgeCheck, Flag, Globe, MapPin, Phone, Star, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import {
  BUSINESS_CATEGORY_LABELS,
  deleteReview,
  fetchBusiness,
  fetchReviews,
  reportBusiness,
  REPORT_REASONS,
  saveReview,
} from "@/lib/businesses";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl, seo } from "@/lib/seo";
import { displayUsername } from "@/lib/usernames";

async function fetchBusinessSeo(id: string) {
  try {
    const { data } = await supabase
      .from("businesses")
      .select(
        "name, category, description, town, logo_url, rating_avg, reviews_count, website, phone",
      )
      .eq("id", id)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/businesses/$businessId")({
  loader: ({ params }) => fetchBusinessSeo(params.businessId),
  head: ({ params, loaderData: b }) => {
    const path = `/businesses/${params.businessId}`;
    if (!b)
      return seo({
        title: "Business — RevMate",
        description: "Local car businesses on RevMate.",
        path,
        noindex: true,
      });
    const category = BUSINESS_CATEGORY_LABELS[b.category] ?? b.category;
    return seo({
      title: `${b.name} — ${category}${b.town ? ` in ${b.town}` : ""} | RevMate reviews`,
      description:
        b.description ||
        `${b.name}, ${category.toLowerCase()}${b.town ? ` in ${b.town}` : ""}. Read reviews from RevMate members.`,
      path,
      image: b.logo_url,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": b.category === "dealer" ? "AutoDealer" : "AutomotiveBusiness",
        name: b.name,
        url: absoluteUrl(path),
        ...(b.logo_url ? { image: b.logo_url } : {}),
        ...(b.town
          ? { address: { "@type": "PostalAddress", addressLocality: b.town, addressCountry: "GB" } }
          : {}),
        ...(b.phone ? { telephone: b.phone } : {}),
        ...(b.reviews_count > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(b.rating_avg),
                reviewCount: b.reviews_count,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
    });
  },
  component: BusinessPage,
});

function BusinessPage() {
  const { businessId } = Route.useParams();
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const { data: business, isLoading } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => fetchBusiness(businessId),
  });
  const { data: reviews } = useQuery({
    queryKey: ["business", businessId, "reviews"],
    queryFn: () => fetchReviews(businessId),
  });
  const mine = reviews?.find((r) => r.user_id === user?.id);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("poor_work");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
    void queryClient.invalidateQueries({ queryKey: ["businesses"] });
  }

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>
    );
  if (!business)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p>This business isn't listed.</p>
        <Link to="/businesses" className="mt-2 inline-block text-sm text-primary">
          Browse businesses
        </Link>
      </main>
    );
  const isOwner = user?.id === business.owner_user_id;

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !rating) return;
    setBusy(true);
    try {
      await saveReview(businessId, user.id, rating, body, mine?.id);
      toast.success("Thanks — your review is live.");
      setWriting(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your review");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await reportBusiness(businessId, user.id, reason, details);
      toast.success("Thanks — RevMate's team will look into it.");
      setReporting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/businesses" className="text-sm text-muted-foreground hover:text-foreground">
        ← All businesses
      </Link>
      <section className="mt-3 rounded-xl border border-border bg-card p-5">
        <div className="flex gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
            {business.logo_url ? (
              <img src={business.logo_url} alt="" className="size-full object-cover" />
            ) : (
              <Store className="size-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-xl font-semibold">
              {business.name}
              {business.verified && (
                <BadgeCheck className="size-5 text-primary" aria-label="Verified by RevMate" />
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {BUSINESS_CATEGORY_LABELS[business.category] ?? business.category}
              {business.town && (
                <>
                  {" · "}
                  <MapPin className="inline size-3.5" /> {business.town}
                </>
              )}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              {business.reviews_count > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Stars rating={Number(business.rating_avg)} className="size-4" />
                  <strong>{Number(business.rating_avg).toFixed(1)}</strong>
                  <span className="text-muted-foreground">({business.reviews_count} reviews)</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
              <TrustBadge business={business} />
            </div>
          </div>
        </div>
        {business.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm">{business.description}</p>
        )}
        {business.covers_areas.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Covers: {business.covers_areas.join(", ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {business.website && (
            <a
              href={business.website}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Globe className="size-4" /> Website
            </a>
          )}
          {business.phone && (
            <a
              href={`tel:${business.phone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium"
            >
              <Phone className="size-4" /> Call
            </a>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Member reviews</h2>
          {!isOwner && (
            <button
              type="button"
              onClick={() => {
                if (!user) return openAuthModal("Create a free account to review businesses.");
                setRating(mine?.rating ?? 0);
                setBody(mine?.body ?? "");
                setWriting(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium"
            >
              <Star className="size-4" /> {mine ? "Edit your review" : "Write a review"}
            </button>
          )}
        </div>
        {writing && (
          <form
            onSubmit={submitReview}
            className="mt-3 space-y-3 rounded-xl border border-border p-4"
          >
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setRating(n)}
                >
                  <Star
                    className={`size-8 ${n <= rating ? "text-amber-500" : "text-muted-foreground/40"}`}
                    fill="currentColor"
                  />
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What did they do, and how was it? Price, quality, communication…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Be honest and fair. Reviews must be about your own experience.
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy || !rating}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving…" : "Post review"}
              </button>
              {mine && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteReview(mine.id).catch((err: Error) => toast.error(err.message));
                    setWriting(false);
                    refresh();
                  }}
                  className="rounded-md px-3 py-2 text-sm text-destructive"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setWriting(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        <ul className="mt-3 space-y-3">
          {reviews?.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Avatar
                  photoUrl={r.profiles?.avatar_url}
                  fallback={r.profiles?.username}
                  className="size-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {displayUsername(r.profiles?.username, "Member")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.body && <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>}
            </li>
          ))}
          {reviews?.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Be the first to review {business.name}.
            </li>
          )}
        </ul>
      </section>

      <div className="mt-6 border-t border-border pt-4">
        {!reporting ? (
          <button
            type="button"
            onClick={() =>
              user
                ? setReporting(true)
                : openAuthModal("Create a free account to report a business.")
            }
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Flag className="size-3.5" /> Report this business
          </button>
        ) : (
          <form onSubmit={submitReport} className="space-y-2 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">Report {business.name}</p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(REPORT_REASONS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What happened? Only RevMate's team sees this."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
              >
                Send report
              </button>
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

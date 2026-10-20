import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheck,
  Camera,
  Clock,
  Flag,
  Globe,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { Avatar } from "@/components/Avatar";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import {
  addBusinessPhoto,
  BUSINESS_CATEGORY_LABELS,
  DAYS,
  deleteReview,
  fetchBusiness,
  fetchBusinessPhotos,
  fetchReviews,
  openStatus,
  replyToReview,
  reportBusiness,
  REPORT_REASONS,
  saveReview,
  sectorOf,
  todayKey,
  useBusinessProfilesFeature,
  type BusinessPhoto,
  type BusinessProfile,
  type BusinessReview,
} from "@/lib/businesses";
import { PhotoLightbox, PhotoMosaic } from "@/components/BusinessPhotos";
import { BusinessManager } from "@/components/BusinessManager";
import { useProfile } from "@/hooks/useProfile";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl, seo } from "@/lib/seo";
import { displayUsername } from "@/lib/usernames";
import { BusinessProCard } from "@/components/BusinessProCard";
import { usePaidReturn } from "@/hooks/usePaidReturn";
import { Button } from "@/components/ui/button";

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
  validateSearch: (search: Record<string, unknown>): { manage?: boolean } => search["manage"] === true || search["manage"] === "true" ? { manage: true } : {},
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
        "@type": sectorOf(b.category)?.id === "dealers" ? "AutoDealer" : "AutomotiveBusiness",
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

type Tab = "overview" | "reviews" | "photos" | "manage";

function BusinessPage() {
  const { businessId } = Route.useParams();
  const search = Route.useSearch();
  const { user } = useAuth();
  const { data: me } = useProfile();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const profilesOn = useBusinessProfilesFeature();
  usePaidReturn("You're on Business Pro. Thanks!", [["business"], ["businesses"]]);
  const { data: business, isLoading } = useQuery({
    queryKey: ["business", businessId],
    queryFn: async () => (await fetchBusiness(businessId)) as BusinessProfile | null,
  });
  const { data: reviews } = useQuery({
    queryKey: ["business", businessId, "reviews"],
    queryFn: () => fetchReviews(businessId),
  });
  const { data: photos = [] } = useQuery({
    queryKey: ["business", businessId, "photos"],
    queryFn: () => fetchBusinessPhotos(businessId),
    enabled: profilesOn,
  });
  const [tab, setTab] = useState<Tab>(search.manage ? "manage" : "overview");
  const [viewer, setViewer] = useState<{ list: BusinessPhoto[]; index: number } | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"all" | "business" | "customer">("all");

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
  const isAdmin = me?.role === "admin" && me.account_status === "active";
  const canManage = profilesOn && !!user && (isOwner || isAdmin);
  // Business photos lead the gallery; customers' follow.
  const gallery = [
    ...photos.filter((p) => p.source === "business"),
    ...photos.filter((p) => p.source === "customer"),
  ];
  const status = openStatus(business.opening_hours);
  const where = business.address || business.town;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [business.name, business.address || business.town || business.postcode_district]
      .filter(Boolean)
      .join(", "),
  )}`;
  const filtered =
    photoFilter === "all" ? gallery : gallery.filter((p) => p.source === photoFilter);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: business!.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // Cancelled.
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-10 pt-3">
      <Link to="/businesses" className="text-sm text-muted-foreground hover:text-foreground">
        ← All businesses
      </Link>
      <div className="mt-3">
        <PhotoMosaic
          photos={gallery}
          name={business.name}
          logoUrl={business.logo_url}
          onOpen={(index) => setViewer({ list: gallery, index })}
        />
      </div>

      <section className="mt-4">
        {canManage && <Button variant="outline" className="mb-3" onClick={() => setTab("manage")}>Manage business</Button>}
        <h1 className="flex items-center gap-1.5 text-2xl font-bold leading-tight">
          {business.name}
          {business.verified && (
            <BadgeCheck className="size-6 shrink-0 text-primary" aria-label="Verified by RevMate" />
          )}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {business.reviews_count > 0 ? (
            <button
              type="button"
              onClick={() => setTab("reviews")}
              className="flex items-center gap-1.5"
            >
              <strong>{Number(business.rating_avg).toFixed(1)}</strong>
              <Stars rating={Number(business.rating_avg)} className="size-4" />
              <span className="text-muted-foreground underline-offset-2 hover:underline">
                ({business.reviews_count})
              </span>
            </button>
          ) : (
            <span className="text-muted-foreground">No reviews yet</span>
          )}
          <TrustBadge business={business} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {BUSINESS_CATEGORY_LABELS[business.category] ?? business.category}
          {business.town ? ` · ${business.town}` : ""}
        </p>
        {status && (
          <p className="mt-1 text-sm">
            <span
              className={`font-semibold ${status.open ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {status.open ? "Open" : "Closed"}
            </span>
            <span className="text-muted-foreground"> · {status.text}</span>
          </p>
        )}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {business.phone && (
            <ActionButton
              href={`tel:${business.phone.replace(/\s+/g, "")}`}
              icon={Phone}
              label="Call"
              primary
            />
          )}
          {where && (
            <ActionButton href={directions} icon={Navigation} label="Directions" external />
          )}
          {business.website && (
            <ActionButton href={business.website} icon={Globe} label="Website" external />
          )}
          <ActionButton onClick={() => void share()} icon={Share2} label="Share" />
        </div>
      </section>

      <nav className="sticky top-0 z-10 -mx-4 mt-4 flex border-b border-border bg-background/95 px-4 backdrop-blur">
        {(
          [
            ["overview", "Overview"],
            ["reviews", `Reviews${business.reviews_count ? ` (${business.reviews_count})` : ""}`],
            ...(profilesOn
              ? ([["photos", `Photos${gallery.length ? ` (${gallery.length})` : ""}`]] as const)
              : []),
            ...(canManage ? ([["manage", "Manage"]] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          {business.description && (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">
              {business.description}
            </p>
          )}
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {where && (
              <InfoRow icon={MapPin}>
                <a href={directions} target="_blank" rel="noreferrer" className="hover:underline">
                  {business.address ||
                    [business.town, business.postcode_district].filter(Boolean).join(", ")}
                </a>
              </InfoRow>
            )}
            {business.opening_hours && Object.keys(business.opening_hours).length > 0 && (
              <InfoRow icon={Clock}>
                <OpeningHoursList hours={business.opening_hours} />
              </InfoRow>
            )}
            {business.phone && (
              <InfoRow icon={Phone}>
                <a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="hover:underline">
                  {business.phone}
                </a>
              </InfoRow>
            )}
            {business.website && (
              <InfoRow icon={Globe}>
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="break-all hover:underline"
                >
                  {business.website.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </InfoRow>
            )}
            {business.email && (
              <InfoRow icon={Mail}>
                <a href={`mailto:${business.email}`} className="break-all hover:underline">
                  {business.email}
                </a>
              </InfoRow>
            )}
            {business.contact_name && <InfoRow icon={Mail}>Contact: {business.contact_name}</InfoRow>}
            {business.covers_areas.length > 0 && (
              <InfoRow icon={Truck}>Covers {business.covers_areas.join(", ")}</InfoRow>
            )}
          </ul>
          {(business.services?.length ?? 0) > 0 && (
            <div className="mt-4">
              <h2 className="font-bold">Services</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {business.services!.map((s) => (
                  <span key={s} className="rounded-full bg-muted px-3 py-1 text-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {gallery.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Photos</h2>
                <button
                  type="button"
                  onClick={() => setTab("photos")}
                  className="text-sm font-semibold text-primary"
                >
                  See all
                </button>
              </div>
              <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
                {gallery.slice(0, 10).map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewer({ list: gallery, index: i })}
                    className="size-28 shrink-0 overflow-hidden rounded-xl"
                    aria-label={`Open photo ${i + 1}`}
                  >
                    <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <ReviewsSection
            business={business}
            reviews={reviews ?? []}
            photos={photos}
            preview
            onSeeAll={() => setTab("reviews")}
            onOpenPhotos={(list, index) => setViewer({ list, index })}
            user={user}
            openAuthModal={openAuthModal}
            canReply={isOwner || isAdmin}
            profilesOn={profilesOn}
            refresh={() => {
              void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
              void queryClient.invalidateQueries({ queryKey: ["businesses"] });
            }}
          />
        </>
      )}

      {tab === "reviews" && (
        <ReviewsSection
          business={business}
          reviews={reviews ?? []}
          photos={photos}
          onOpenPhotos={(list, index) => setViewer({ list, index })}
          user={user}
          openAuthModal={openAuthModal}
          canReply={isOwner || isAdmin}
          profilesOn={profilesOn}
          refresh={() => {
            void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
            void queryClient.invalidateQueries({ queryKey: ["businesses"] });
          }}
        />
      )}

      {tab === "photos" && (
        <section className="mt-4">
          <div className="flex gap-1.5">
            {(
              [
                ["all", "All"],
                ["business", "By the business"],
                ["customer", "By customers"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPhotoFilter(id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${photoFilter === id ? "bg-foreground text-background" : "bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No photos here yet.</p>
          ) : (
            <div className="-mx-4 mt-3 grid grid-cols-3 gap-0.5 sm:mx-0">
              {filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setViewer({ list: filtered, index: i })}
                  className="aspect-square overflow-hidden"
                  aria-label={`Open photo ${i + 1}`}
                >
                  <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Customers can add photos when they write a review.
          </p>
        </section>
      )}

      {tab === "manage" && canManage && user && (
        <BusinessManager key={business.id} business={business} photos={photos} userId={user.id} />
      )}
      {tab === "manage" && isOwner && <BusinessProCard businessId={business.id} />}

      <ReportBusiness business={business} user={user} openAuthModal={openAuthModal} />

      {viewer && (
        <PhotoLightbox
          photos={viewer.list}
          index={viewer.index}
          onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </main>
  );
}

function ActionButton({
  href,
  onClick,
  icon: Icon,
  label,
  primary,
  external,
}: {
  href?: string;
  onClick?: () => void;
  icon: typeof Phone;
  label: string;
  primary?: boolean;
  external?: boolean;
}) {
  const cls = `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${primary ? "bg-primary text-primary-foreground" : "border border-input bg-background"}`;
  return href ? (
    <a
      href={href}
      className={cls}
      {...(external ? { target: "_blank", rel: "noreferrer nofollow" } : {})}
    >
      <Icon className="size-4" /> {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      <Icon className="size-4" /> {label}
    </button>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3 text-[15px]">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function OpeningHoursList({ hours }: { hours: NonNullable<BusinessProfile["opening_hours"]> }) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const status = openStatus(hours);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
        {status && (
          <>
            <span
              className={
                status.open
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-red-600 dark:text-red-400"
              }
            >
              {status.open ? "Open" : "Closed"}
            </span>{" "}
            · {status.text}{" "}
          </>
        )}
        <span className="text-sm text-primary">{open ? "Hide hours" : "See hours"}</span>
      </button>
      {open && (
        <table className="mt-2 w-full text-sm">
          <tbody>
            {DAYS.map(([key, name]) => {
              const day = hours[key];
              return (
                <tr key={key} className={key === today ? "font-semibold" : ""}>
                  <td className="py-0.5 pr-4">{name}</td>
                  <td className="py-0.5">{day ? `${day.open}–${day.close}` : "Closed"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReviewsSection({
  business,
  reviews,
  photos,
  preview,
  onSeeAll,
  onOpenPhotos,
  user,
  openAuthModal,
  canReply,
  profilesOn,
  refresh,
}: {
  business: BusinessProfile;
  reviews: BusinessReview[];
  photos: BusinessPhoto[];
  preview?: boolean;
  onSeeAll?: () => void;
  onOpenPhotos: (list: BusinessPhoto[], index: number) => void;
  user: { id: string } | null;
  openAuthModal: (message: string) => void;
  canReply: boolean;
  profilesOn: boolean;
  refresh: () => void;
}) {
  const queryClient = useQueryClient();
  const mine = reviews.find((r) => r.user_id === user?.id);
  const isOwner = user?.id === business.owner_user_id;
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const counts = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.rating === n).length);
  const shown = preview ? reviews.slice(0, 3) : reviews;
  const photosFor = (reviewId: string) => photos.filter((p) => p.review_id === reviewId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !rating) return;
    setBusy(true);
    try {
      const reviewId = await saveReview(business.id, user.id, rating, body, mine?.id);
      let failed = 0;
      for (const file of files) {
        try {
          const url = await uploadImage("user-media", user.id, file);
          await addBusinessPhoto(business.id, url, reviewId);
        } catch {
          failed++;
        }
      }
      toast.success(
        failed
          ? `Review posted, but ${failed} photo(s) didn't upload.`
          : "Thanks, your review is live.",
      );
      setWriting(false);
      setFiles([]);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["business", business.id, "photos"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your review");
    } finally {
      setBusy(false);
    }
  }

  const existingPhotos = mine ? photosFor(mine.id).length : 0;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Reviews</h2>
        {!isOwner && (
          <button
            type="button"
            onClick={() => {
              if (!user) return openAuthModal("Create a free account to review businesses.");
              setRating(mine?.rating ?? 0);
              setBody(mine?.body ?? "");
              setWriting(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-input px-3 py-1.5 text-sm font-semibold"
          >
            <Star className="size-4" /> {mine ? "Edit your review" : "Write a review"}
          </button>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="mt-3 flex items-center gap-4">
          <div className="text-center">
            <p className="text-4xl font-bold">{Number(business.rating_avg).toFixed(1)}</p>
            <Stars rating={Number(business.rating_avg)} className="size-3.5" />
            <p className="text-xs text-muted-foreground">{business.reviews_count} reviews</p>
          </div>
          <div className="flex-1 space-y-1">
            {counts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2 text-muted-foreground">{5 - i}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {writing && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl border border-border p-4">
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
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          {profilesOn && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <div key={i} className="relative size-16 overflow-hidden rounded-lg">
                    <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
                      aria-label="Remove photo"
                      className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {files.length + existingPhotos < 5 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-input text-xs text-muted-foreground"
                  >
                    <Camera className="size-5" /> Photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = [...(e.target.files ?? [])].filter((f) => {
                    const problem = validateImageFile(f);
                    if (problem) toast.error(problem);
                    return !problem;
                  });
                  setFiles((list) => [...list, ...picked].slice(0, 5 - existingPhotos));
                  e.target.value = "";
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Add up to 5 photos of the work or the place.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Be honest and fair. Reviews must be about your own experience.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy || !rating}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
                className="rounded-full px-3 py-2 text-sm text-destructive"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setWriting(false)}
              className="rounded-full px-3 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="mt-4 divide-y divide-border">
        {shown.map((r) => (
          <ReviewItem
            key={r.id}
            review={r}
            photos={photosFor(r.id)}
            onOpenPhotos={onOpenPhotos}
            canReply={canReply && profilesOn}
            businessName={business.name}
            refresh={refresh}
          />
        ))}
        {reviews.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">
            Be the first to review {business.name}.
          </li>
        )}
      </ul>
      {preview && reviews.length > 3 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-2 text-sm font-semibold text-primary"
        >
          See all {reviews.length} reviews
        </button>
      )}
    </section>
  );
}

function ReviewItem({
  review: r,
  photos,
  onOpenPhotos,
  canReply,
  businessName,
  refresh,
}: {
  review: BusinessReview;
  photos: BusinessPhoto[];
  onOpenPhotos: (list: BusinessPhoto[], index: number) => void;
  canReply: boolean;
  businessName: string;
  refresh: () => void;
}) {
  const reply = r as BusinessReview & {
    owner_reply?: string | null;
    owner_replied_at?: string | null;
  };
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(reply.owner_reply ?? "");
  const [busy, setBusy] = useState(false);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await replyToReview(r.id, text);
      setReplying(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-4">
      <div className="flex items-center gap-2">
        <Avatar
          photoUrl={r.profiles?.avatar_url}
          fallback={r.profiles?.username}
          className="size-9"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{displayUsername(r.profiles?.username, "Member")}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Stars rating={r.rating} className="size-3" />
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      {r.body && <p className="mt-2 whitespace-pre-wrap text-[15px]">{r.body}</p>}
      {photos.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPhotos(photos, i)}
              className="size-20 shrink-0 overflow-hidden rounded-lg"
              aria-label={`Open review photo ${i + 1}`}
            >
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {reply.owner_reply && !replying && (
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
          <p className="font-semibold">
            Reply from {businessName}
            {reply.owner_replied_at && (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {formatDistanceToNow(new Date(reply.owner_replied_at), { addSuffix: true })}
              </span>
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{reply.owner_reply}</p>
        </div>
      )}
      {canReply && !replying && (
        <button
          type="button"
          onClick={() => setReplying(true)}
          className="mt-2 text-sm font-semibold text-primary"
        >
          {reply.owner_reply ? "Edit reply" : "Reply"}
        </button>
      )}
      {replying && (
        <form onSubmit={sendReply} className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Thank them, or explain what happened. Keep it polite."
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Saving…" : text.trim() ? "Post reply" : "Remove reply"}
            </button>
            <button
              type="button"
              onClick={() => setReplying(false)}
              className="rounded-full px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function ReportBusiness({
  business,
  user,
  openAuthModal,
}: {
  business: BusinessProfile;
  user: { id: string } | null;
  openAuthModal: (message: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("poor_work");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await reportBusiness(business.id, user.id, reason, details);
      toast.success("Thanks — RevMate's team will look into it.");
      setReporting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      {!reporting ? (
        <button
          type="button"
          onClick={() =>
            user ? setReporting(true) : openAuthModal("Create a free account to report a business.")
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
  );
}

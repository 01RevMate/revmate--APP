import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { FoundingSpotsNote } from "@/components/FoundingMember";
import { InAppBrowserTip } from "@/components/InAppBrowserTip";
import { useAuth } from "@/hooks/useAuth";
import { countVisit, getAttribution } from "@/lib/attribution";
import { CAMPAIGNS, findCampaign } from "@/lib/campaigns";
import { trackAdEvent } from "@/lib/tiktokPixel";

// TikTok / ad landing pages: revmate.co.uk/go/fuel, /go/ev, /go/sell…
// /go/tiktok (or any unknown name) is a link-in-bio page with everything.
export const Route = createFileRoute("/go/$campaign")({
  head: ({ params }) => {
    const c = findCampaign(params.campaign);
    const title = c ? `${c.headline} — RevMate` : "RevMate — the UK car app";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: c?.sub ?? "Fuel prices, EV chargers, car meets and free adverts.",
        },
        { name: "robots", content: "noindex, follow" },
        { property: "og:title", content: title },
      ],
    };
  },
  component: CampaignPage,
});

function CampaignPage() {
  const { campaign: slug } = Route.useParams();
  const { user } = useAuth();
  const c = findCampaign(slug);

  useEffect(() => {
    const a = getAttribution();
    // Arrived on another page first and tapped through here: still count it.
    if (/^[a-z0-9_-]{1,40}$/.test(slug)) countVisit(slug, a?.source ?? "direct");
    trackAdEvent("ViewContent", { content_id: slug, content_type: "product" });
  }, [slug]);

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <InAppBrowserTip />
      <div className="mt-3 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-700 p-6 text-white">
        {/* White logo: the hero is dark in both themes. */}
        <img
          src="/brand/revmate-logo-dark.png"
          alt="RevMate"
          className="h-7 w-auto object-contain"
        />
        {c ? (
          <>
            <p className="mt-5 text-4xl" aria-hidden>
              {c.emoji}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
              {c.headline}
            </h1>
            <p className="mt-2 text-white/85">{c.sub}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {c.points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" /> {p}
                </li>
              ))}
            </ul>
            <Link
              to={c.to}
              className="mt-6 flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-lg font-bold text-neutral-900"
            >
              {c.cta} <ArrowRight className="size-5" />
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight">
              The UK car app
            </h1>
            <p className="mt-2 text-white/85">
              Fuel prices, EV chargers, meets, free adverts and a community of real owners.
            </p>
          </>
        )}
      </div>

      {!user && (
        <div className="mt-4 space-y-2">
          <FoundingSpotsNote />
          <Link
            to="/signup"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-input font-semibold"
          >
            Join RevMate free
          </Link>
        </div>
      )}

      <h2 className="mt-8 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {c ? "More on RevMate" : "Pick what you need"}
      </h2>
      <ul className="mt-2 space-y-2">
        {CAMPAIGNS.filter((x) => x.slug !== c?.slug).map((x) => (
          <li key={x.slug}>
            <Link
              to={x.to}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted/50"
            >
              <span className="text-2xl" aria-hidden>
                {x.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{x.cta}</span>
                <span className="block truncate text-xs text-muted-foreground">{x.headline}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

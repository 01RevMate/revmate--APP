import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// A small public rating badge for a business: "4.8 ★ on RevMate". Anyone can embed it as an image and
// wrap it in a link to the business page, which is the backlink. It is a plain SVG: no JavaScript, and
// nothing is stored. It reads the business as a signed-out visitor, so row-level security decides what
// is public (only approved, non-suspended businesses). A business with no reviews yet gets no badge
// rather than an empty or made-up rating.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAR = "M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z";

function badgeSvg(rating: number, count: number) {
  const pct = Math.max(0, Math.min(5, rating)) / 5;
  const label = `${rating.toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"} on RevMate`;
  const stars = [0, 1, 2, 3, 4]
    .map((i) => `<path transform="translate(${12 + i * 21} 11)" d="${STAR}"/>`)
    .join("");
  const barWidth = 5 * 21 * pct;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="236" height="48" viewBox="0 0 236 48" role="img" aria-label="${label}">
<title>${label}</title>
<rect width="236" height="48" rx="8" fill="#ffffff" stroke="#d4d4d8"/>
<defs><clipPath id="f"><rect x="12" y="0" width="${barWidth.toFixed(1)}" height="48"/></clipPath></defs>
<g fill="#e4e4e7">${stars}</g>
<g fill="#f59e0b" clip-path="url(#f)">${stars}</g>
<text x="124" y="22" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="15" font-weight="700" fill="#18181b">${rating.toFixed(1)}</text>
<text x="124" y="38" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="10.5" fill="#52525b">${count} ${count === 1 ? "review" : "reviews"} on RevMate</text>
</svg>`;
}

export const Route = createFileRoute("/businesses/$businessId_/badge.svg")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { businessId: string } }) => {
        const notFound = () =>
          new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
        if (!UUID.test(params.businessId)) return notFound();
        try {
          const { data } = await supabase
            .from("businesses")
            .select("rating_avg, reviews_count")
            .eq("id", params.businessId)
            .maybeSingle();
          if (!data || !(data.reviews_count > 0)) return notFound();
          return new Response(badgeSvg(Number(data.rating_avg), data.reviews_count), {
            headers: {
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "public, max-age=600, s-maxage=3600",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});

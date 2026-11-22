import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl, pickShareImage } from "@/lib/seo";
import { carPath, type Car } from "@/lib/cars";
import { looseRpc } from "@/lib/publicProfiles";

// Pages anyone can open without an account: static pages, every live
// listing (with photos, for Google Images), car research pages, upcoming
// meets, businesses and adults' public profiles.
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
  { path: "/businesses", changefreq: "daily", priority: "0.7" },
  { path: "/cars", changefreq: "weekly", priority: "0.8" },
  { path: "/issues", changefreq: "daily", priority: "0.7" },
  { path: "/diagnose", changefreq: "weekly", priority: "0.8" },
  { path: "/shops", changefreq: "daily", priority: "0.6" },
  { path: "/meets", changefreq: "daily", priority: "0.7" },
  { path: "/ev-chargers", changefreq: "weekly", priority: "0.7" },
  { path: "/ev-chargers/home", changefreq: "weekly", priority: "0.7" },
  { path: "/ev-chargers/community", changefreq: "weekly", priority: "0.7" },
  { path: "/fuel-prices", changefreq: "daily", priority: "0.7" },
  { path: "/groups", changefreq: "daily", priority: "0.6" },
  { path: "/signup", changefreq: "monthly", priority: "0.5" },
  { path: "/community-standards", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/terms", changefreq: "monthly", priority: "0.2" },
  { path: "/legal/privacy", changefreq: "monthly", priority: "0.2" },
  { path: "/legal/cookies", changefreq: "monthly", priority: "0.2" },
  { path: "/legal/safety", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/updates", changefreq: "weekly", priority: "0.3" },
];

const escapeXml = (value: string) =>
  value.replace(
    /[<>&'"]/g,
    (c) => `&${{ "<": "lt", ">": "gt", "&": "amp", "'": "apos", '"': "quot" }[c]};`,
  );

// Google reads up to 50,000 URLs per sitemap; we split well before that so each file stays fast.
const MAX_URLS_PER_SITEMAP = 5000;

type CarRow = Pick<Car, "id" | "make" | "model" | "generation" | "created_at">;

/**
 * Every car page worth reading: a car with at least one fault, or at least one public post, whatever
 * its status (the seeded cars are "unverified"). Read as a signed-out visitor, so the `cars` access
 * rule decides what is public and nothing private can leak.
 */
async function fetchCarsWithContent(): Promise<CarRow[]> {
  const byId = new Map<string, CarRow>();
  const { data: withFaults } = await supabase
    .from("cars")
    .select("id, make, model, generation, created_at, car_faults!inner(id)")
    .limit(5000);
  for (const car of withFaults ?? []) byId.set(car.id, car);

  const { data: tagged } = await supabase
    .from("posts")
    .select("car_id")
    .not("car_id", "is", null)
    .is("group_id", null)
    .limit(5000);
  const postCarIds = [...new Set((tagged ?? []).map((p) => p.car_id as string))].filter(
    (id) => !byId.has(id),
  );
  for (let i = 0; i < postCarIds.length; i += 100) {
    const { data } = await supabase
      .from("cars")
      .select("id, make, model, generation, created_at")
      .in("id", postCarIds.slice(i, i + 100));
    for (const car of data ?? []) byId.set(car.id, car);
  }
  return [...byId.values()];
}

const xml = (body: string) =>
  new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { data: listings } = await supabase
          .from("listings")
          .select("id, title, photos, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5000);

        const { data: businesses } = await supabase
          .from("businesses")
          .select("id, created_at")
          .eq("status", "active")
          .limit(5000);

        // Every car research page with faults or public posts (specs, common faults, for sale).
        const cars = await fetchCarsWithContent();

        // Public fault posts: a problem and (when solved) its fix. The signed-out access rules
        // (adults only, no groups) apply to this read, so nothing private is listed.
        const { data: faultPosts } = await supabase
          .from("posts")
          .select("id, created_at")
          .not("issue_status", "is", null)
          .is("group_id", null)
          .order("created_at", { ascending: false })
          .limit(5000);

        // Upcoming car meets (public events).
        const { data: meets } = await supabase
          .from("car_meets")
          .select("id, created_at")
          .is("cancelled_at", null)
          .gte("starts_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(2000);

        // Adults' public profiles (0055); skipped until that SQL has run.
        const { data: profileRows } = await looseRpc("public_profile_handles", { max_rows: 5000 });
        const profiles = profileRows as { username: string; created_at: string }[] | null;

        const urls = [
          ...STATIC_PAGES.map(
            (page) =>
              `<url><loc>${escapeXml(absoluteUrl(page.path))}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`,
          ),
          ...(listings ?? []).map((listing) => {
            const images = (listing.photos ?? [])
              .filter((url) => pickShareImage(url))
              .slice(0, 10)
              .map(
                (url) =>
                  `<image:image><image:loc>${escapeXml(url)}</image:loc><image:title>${escapeXml(listing.title)}</image:title></image:image>`,
              )
              .join("");
            return `<url><loc>${escapeXml(absoluteUrl(`/marketplace/${listing.id}`))}</loc><lastmod>${listing.created_at.slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>0.8</priority>${images}</url>`;
          }),
          ...cars.map((car) => {
            const { params } = carPath(car);
            // Slugs can contain "/" and brackets (e.g. "197/200-(mk3)"), so encode each segment.
            const path = [params.make, params.model, params.generation]
              .map(encodeURIComponent)
              .join("/");
            return `<url><loc>${escapeXml(absoluteUrl(`/cars/${path}`))}</loc><lastmod>${car.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
          }),
          ...(faultPosts ?? []).map(
            (post) =>
              `<url><loc>${escapeXml(absoluteUrl(`/posts/${post.id}`))}</loc><lastmod>${post.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
          ),
          ...(meets ?? []).map(
            (m) =>
              `<url><loc>${escapeXml(absoluteUrl(`/meets/${m.id}`))}</loc><lastmod>${m.created_at.slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`,
          ),
          ...(profiles ?? []).map(
            (p) =>
              `<url><loc>${escapeXml(absoluteUrl(`/u/${encodeURIComponent(p.username.replace(/^@/, ""))}`))}</loc><lastmod>${p.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
          ),
          ...(businesses ?? []).map(
            (b) =>
              `<url><loc>${escapeXml(absoluteUrl(`/businesses/${b.id}`))}</loc><lastmod>${b.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
          ),
        ];

        const urlset = (entries: string[]) =>
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join("\n")}\n</urlset>\n`;

        if (urls.length <= MAX_URLS_PER_SITEMAP) return xml(urlset(urls));

        // Too many for one file: /sitemap.xml becomes an index, and /sitemap.xml?page=N holds each slice.
        const pages = Math.ceil(urls.length / MAX_URLS_PER_SITEMAP);
        const page = Number(new URL(request.url).searchParams.get("page"));
        if (Number.isInteger(page) && page >= 1 && page <= pages) {
          return xml(
            urlset(urls.slice((page - 1) * MAX_URLS_PER_SITEMAP, page * MAX_URLS_PER_SITEMAP)),
          );
        }
        const today = new Date().toISOString().slice(0, 10);
        return xml(
          `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(
            { length: pages },
            (_, i) =>
              `<sitemap><loc>${escapeXml(absoluteUrl(`/sitemap.xml?page=${i + 1}`))}</loc><lastmod>${today}</lastmod></sitemap>`,
          ).join("\n")}\n</sitemapindex>\n`,
        );
      },
    },
  },
});

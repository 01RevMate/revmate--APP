import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl, pickShareImage } from "@/lib/seo";

// Pages anyone can open without an account, plus every live listing (with
// its photos, for Google Images). Signed-in-only pages are left out until
// they're viewable signed out.
const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
  { path: "/businesses", changefreq: "daily", priority: "0.7" },
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

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
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

        // Adults' public profiles (0055); skipped until that SQL has run.
        const { data: profiles } = await supabase.rpc("public_profile_handles", { max_rows: 5000 });

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
          ...(profiles ?? []).map(
            (p) =>
              `<url><loc>${escapeXml(absoluteUrl(`/u/${encodeURIComponent(p.username.replace(/^@/, ""))}`))}</loc><lastmod>${p.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
          ),
          ...(businesses ?? []).map(
            (b) =>
              `<url><loc>${escapeXml(absoluteUrl(`/businesses/${b.id}`))}</loc><lastmod>${b.created_at.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
          ),
        ];

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`,
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=900",
            },
          },
        );
      },
    },
  },
});

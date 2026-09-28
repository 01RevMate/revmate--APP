import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo";

// Served from a route (not public/) so the sitemap line always carries the
// site's real address.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /settings",
            "Disallow: /messages",
            "Disallow: /admin",
            "Disallow: /analytics",
            "Disallow: /reset-password",
            "Disallow: /forgot-password",
            "",
            `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
            "",
          ].join("\n"),
          {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          },
        ),
    },
  },
});

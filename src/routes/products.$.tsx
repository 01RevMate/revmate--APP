import { createFileRoute, redirect } from "@tanstack/react-router";
import { SHOP_ORIGIN } from "@/lib/shop";

/**
 * Legacy Shopify product URLs from when revmate.co.uk was a Shopify store
 * (e.g. /products/audi-rs6-split-the-bill-hoodie.json). Bots and saved links
 * still hit them, so send every one to the matching product on the new
 * storefront instead of a 404. The old ".json" API suffix is stripped —
 * Shopify serves the normal product page at the same handle.
 */
export const Route = createFileRoute("/products/$")({
  beforeLoad: ({ params }) => {
    const splat = params._splat ?? "";
    const handle = splat.replace(/\.json$/i, "").replace(/\/+$/, "");
    const target = handle
      ? `${SHOP_ORIGIN}/products/${handle}`
      : SHOP_ORIGIN;
    throw redirect({ href: target });
  },
  component: () => null,
});

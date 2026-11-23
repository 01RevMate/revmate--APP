// Public browsing only; private actions keep their own session checks.
const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/search\/?$/,
  /^\/marketplace(\/[^/]+)?\/?$/,
  /^\/(login|signup|forgot-password|reset-password)\/?$/,
  /^\/legal\/.+/,
  /^\/community-standards\/?$/,
  /^\/businesses(\/[^/]+)?\/?$/,
  /^\/cars(\/.*)?$/,
  /^\/issues\/?$/,
  /^\/meets(\/[^/]+)?\/?$/,
  /^\/groups\/?$/,
  /^\/ev-chargers(\/(home|community))?\/?$/,
  /^\/fuel-prices\/?$/,
  /^\/go\/[^/]+\/?$/,
  /^\/plus\/?$/,
  /^\/diagnose\/?$/,
  /^\/shops(\/[^/]+)?\/?$/,
  /^\/store(\/[^/]+)?\/?$/,
  /^\/shop\/?$/,
  /^\/basket\/?$/,
  // Legacy Shopify product links redirect to the new storefront.
  /^\/products(\/.*)?$/,
];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

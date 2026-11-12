/**
 * The RevMate gift shop on shop.revmate.co.uk.
 *
 * Flip SHOP_LIVE to true at launch so every Shop link in the app opens the
 * live storefront again (same URL and new-tab behaviour as before). Until
 * then, Shop opens the in-app /shop coming-soon page instead of the
 * password-locked storefront, which looks like a broken link.
 */
export const SHOP_LIVE = false;

export const SHOP_ORIGIN = "https://shop.revmate.co.uk";

export const SHOP_URL =
  "https://shop.revmate.co.uk/?utm_source=app&utm_medium=nav&utm_campaign=launch_nov26";

export function shopNavTooltip() {
  return SHOP_LIVE ? "Shop, opens in a new tab" : "Shop";
}

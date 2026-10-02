// RevMate's web addresses. The main one is what Google and share links use;
// the others forward to it (src/server.ts). Change the main one with
// VITE_SITE_URL.

function configuredOrigin(): string | null {
  const value = import.meta.env["VITE_SITE_URL"] as string | undefined;
  return value ? value.replace(/\/+$/, "") : null;
}

export const PRIMARY_ORIGIN = configuredOrigin() ?? "https://revmate.co.uk";

/** "revmate.co.uk" — for showing people their profile address. */
export const PRIMARY_HOST = PRIMARY_ORIGIN.replace(/^https?:\/\//, "");

/** Other RevMate addresses that should forward to the main one. */
export const REVMATE_HOSTS = [
  "revmate.co.uk",
  "www.revmate.co.uk",
  "revmate.app",
  "www.revmate.app",
];

/** Where a request on another RevMate domain should be sent, if anywhere. */
export function canonicalRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const host = url.hostname.toLowerCase();
  if (!REVMATE_HOSTS.includes(host) || host === PRIMARY_HOST) return null;
  return `${PRIMARY_ORIGIN}${url.pathname}${url.search}`;
}

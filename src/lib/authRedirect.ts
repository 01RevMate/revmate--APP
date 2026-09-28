// Where to send someone after they log in or sign up — only ever an internal
// RevMate path, so a crafted link can't bounce people to another site.
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (/^\/(login|signup)(\/|\?|$)/.test(value)) return undefined;
  return value;
}

export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

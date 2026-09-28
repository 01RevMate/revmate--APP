import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

// Search and link-preview tags for every page. Link previews (WhatsApp,
// iMessage, Facebook, X, Discord…) and Google read these from the
// server-rendered HTML, so shareable pages load their data in a route
// loader and build their tags here.

export const SITE_NAME = "RevMate";
export const SITE_TAGLINE = "UK Car Community, Garage & Marketplace";
export const DEFAULT_DESCRIPTION =
  "The all-in-one car app for the UK: show off your garage, join car groups and meets, get help with faults, and buy or sell cars and parts.";
/** 1200×630 share card used when a page has no photo of its own. */
export const DEFAULT_SHARE_IMAGE = "/og-default.png";

/**
 * The public address of the site. Set VITE_SITE_URL (e.g.
 * https://revmate.app) so canonical links always point at the main domain;
 * otherwise the address the page was requested on is used.
 */
export const getSiteOrigin = createIsomorphicFn()
  .server(() => configuredOrigin() ?? getRequestUrl({ xForwardedHost: true }).origin)
  .client(() => configuredOrigin() ?? window.location.origin);

function configuredOrigin(): string | null {
  const value = import.meta.env["VITE_SITE_URL"] as string | undefined;
  return value ? value.replace(/\/+$/, "") : null;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getSiteOrigin()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Collapses whitespace and cuts to a search-friendly length on a word boundary. */
export function summarise(text: string | null | undefined, max = 160): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

const isVideo = (url: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

/** First usable still image (skips videos and non-http values). */
export function pickShareImage(...candidates: (string | null | undefined)[]): string | null {
  return (
    candidates.find((url): url is string => !!url && /^https?:\/\//i.test(url) && !isVideo(url)) ??
    null
  );
}

type MetaTag = Record<string, string>;
type Seo = {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
  scripts: { type: string; children: string }[];
};

export function seo({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  noindex = false,
  jsonLd,
  extraMeta = [],
}: {
  /** Full page title, e.g. "Car Battles — RevMate". */
  title: string;
  description: string;
  /** Path of the page without query string, for the canonical link. */
  path?: string;
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article" | "product" | "profile";
  /** Keep private or signed-in-only pages out of search results. */
  noindex?: boolean;
  jsonLd?: object | object[];
  extraMeta?: MetaTag[];
}): Seo {
  const desc = summarise(description);
  const usingDefaultImage = !image;
  const imageUrl = absoluteUrl(image || DEFAULT_SHARE_IMAGE);
  const url = path ? absoluteUrl(path) : null;

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_GB" },
    { property: "og:image", content: imageUrl },
    { property: "og:image:alt", content: imageAlt ?? title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: desc },
    { name: "twitter:image", content: imageUrl },
    {
      name: "robots",
      content: noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
    },
    ...extraMeta,
  ];
  if (usingDefaultImage) {
    meta.push(
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
    );
  }
  if (url) meta.push({ property: "og:url", content: url });

  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return {
    meta,
    links: url ? [{ rel: "canonical", href: url }] : [],
    scripts: blocks.map((block) => ({
      type: "application/ld+json",
      // "</" would end the script tag early if a user typed it in a title.
      children: JSON.stringify(block).replace(/</g, "\\u003c"),
    })),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

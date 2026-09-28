import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/** Shared layout for Terms, Privacy, Cookies and Safety pages. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
      {intro && <div className="mt-4 text-sm leading-relaxed">{intro}</div>}
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-1.5 [&_ul]:space-y-1">
        {children}
      </div>
      <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link to="/legal/terms" className="hover:text-foreground">
          Terms
        </Link>
        <Link to="/legal/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link to="/legal/cookies" className="hover:text-foreground">
          Cookies
        </Link>
        <Link to="/legal/safety" className="hover:text-foreground">
          Safety &amp; reporting
        </Link>
        <Link to="/community-standards" className="hover:text-foreground">
          Community Standards
        </Link>
        <Link to="/legal/updates" className="hover:text-foreground">
          App updates
        </Link>
      </nav>
    </article>
  );
}

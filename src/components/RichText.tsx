import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

// Matches either an @mention or a #hashtag, keeping the character before it
// (start of text, space, punctuation) so "email@example.com" and "C#" don't
// turn into links. Same handle rules as the server-side mention trigger.
const TOKEN = /(^|[^A-Za-z0-9_&])(@[A-Za-z0-9_.]{2,30}|#[A-Za-z][A-Za-z0-9_]{1,39})/g;

/** Post and comment text with tappable @mentions and #hashtags. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const lead = match[1] ?? "";
    const token = match[2] ?? "";
    const start = match.index + lead.length;
    if (start > last) parts.push(text.slice(last, start));
    // A trailing full stop belongs to the sentence, not the handle.
    const clean = token.replace(/\.+$/, "");
    const trailing = token.slice(clean.length);
    parts.push(
      clean.startsWith("@") ? (
        <Link
          key={start}
          to="/u/$username"
          params={{ username: clean.slice(1) }}
          className="font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {clean}
        </Link>
      ) : (
        <Link
          key={start}
          to="/tags/$tag"
          params={{ tag: clean.slice(1).toLowerCase() }}
          className="font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {clean}
        </Link>
      ),
    );
    if (trailing) parts.push(trailing);
    last = start + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </span>
  );
}

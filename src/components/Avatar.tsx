import { displayUsername } from "@/lib/usernames";

export function Avatar({
  photoUrl,
  fallback,
  className = "size-9",
}: {
  photoUrl?: string | null | undefined;
  fallback?: string | null | undefined;
  className?: string | undefined;
}) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase text-muted-foreground`}
    >
      {displayUsername(fallback, "?").replace(/^@/, "").slice(0, 2) || "?"}
    </div>
  );
}

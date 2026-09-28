/** A red circle with a number, e.g. unread messages. Hidden at 0; 99+ caps it. */
export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-background ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

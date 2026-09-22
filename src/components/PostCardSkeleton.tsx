import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton({ immersive = false }: { immersive?: boolean }) {
  return (
    <div
      className={
        immersive
          ? "border-y border-border bg-card p-3 sm:rounded-lg sm:border sm:p-4"
          : "rounded-lg border border-border bg-card p-4"
      }
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
    </div>
  );
}

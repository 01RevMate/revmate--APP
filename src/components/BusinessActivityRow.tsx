import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fetchBusinessActivity } from "@/lib/businessFoundation";

/** Public signals that a business is active and answers its customers. Counts only, no personal data. */
export function BusinessActivityRow({ businessId }: { businessId: string }) {
  const { data } = useQuery({
    queryKey: ["business-activity", businessId],
    queryFn: () => fetchBusinessActivity(businessId),
    staleTime: 60_000,
  });
  if (!data || data.reviews === undefined) return null;
  const reviews = data.reviews ?? 0;
  const replies = data.replies ?? 0;
  const bits: string[] = [];
  if (reviews >= 3) bits.push(`Replies to ${Math.round((replies / reviews) * 100)}% of reviews`);
  if (data.last_reply)
    bits.push(`Last reply ${formatDistanceToNow(new Date(data.last_reply), { addSuffix: true })}`);
  if (data.last_photo)
    bits.push(
      `Photos updated ${formatDistanceToNow(new Date(data.last_photo), { addSuffix: true })}`,
    );
  if (bits.length === 0) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{bits.join(" · ")}</p>;
}

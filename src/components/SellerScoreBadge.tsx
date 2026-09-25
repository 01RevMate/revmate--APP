import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { fetchSellerScore } from "@/lib/sellers";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function SellerScoreBadge({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["seller-score", userId],
    queryFn: () => fetchSellerScore(userId),
  });

  // Only sellers get a score — if they've never listed anything, show nothing.
  if (!data || data.listingsCount === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          Seller score {data.score.toFixed(1)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Based on {data.listingsCount} {data.listingsCount === 1 ? "listing" : "listings"}
        {data.actionedReports > 0
          ? ` and ${data.actionedReports} upheld ${data.actionedReports === 1 ? "report" : "reports"}`
          : " with no upheld reports"}
      </TooltipContent>
    </Tooltip>
  );
}

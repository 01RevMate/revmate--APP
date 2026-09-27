import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocialFeatures } from "@/lib/features";
import { fetchMyRepostedIds, fetchMySavedPostIds } from "@/lib/social";

/** Posts the signed-in user has saved — one shared query for every card. */
export function useMySavedPostIds() {
  const { user } = useAuth();
  const enabled = useSocialFeatures() && !!user;
  const { data } = useQuery({
    queryKey: ["saved-post-ids", user?.id],
    queryFn: () => fetchMySavedPostIds(user!.id),
    enabled,
    staleTime: 60_000,
  });
  return data;
}

/** Original posts the signed-in user has already reposted. */
export function useMyRepostedIds() {
  const { user } = useAuth();
  const enabled = useSocialFeatures() && !!user;
  const { data } = useQuery({
    queryKey: ["reposted-ids", user?.id],
    queryFn: () => fetchMyRepostedIds(user!.id),
    enabled,
    staleTime: 60_000,
  });
  return data;
}

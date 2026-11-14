import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchMyBusinesses } from "@/lib/businesses";
import { looseDb } from "@/lib/looseDb";

/**
 * Business tools (My business, business profile, promotions) stay hidden until a
 * member turns on a business account in Settings. People who already own a
 * business keep access automatically.
 */
export function useBusinessAccount() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const { data: businesses = [], isPending } = useQuery({
    queryKey: ["my-businesses", user?.id],
    queryFn: () => (user ? fetchMyBusinesses(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  // Only true once the business_account column exists (the SQL has been run).
  const switchAvailable = !!profile && "business_account" in profile;
  const flag = (profile as { business_account?: boolean } | null | undefined)?.business_account;
  const enabled = flag === true || businesses.length > 0;

  const setEnabled = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error("Please log in first.");
      const { error } = await looseDb
        .from("profiles")
        .update({ business_account: next })
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });

  return {
    enabled,
    switchAvailable,
    hasBusiness: businesses.length > 0,
    businesses,
    loading: !!user && (isPending || !profile),
    setEnabled,
  };
}

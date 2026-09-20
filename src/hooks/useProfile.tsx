import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export function useProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return { ...query, isAdmin: query.data?.role === "admin" };
}

export const PERSONA_LABELS: Record<Profile["persona"], string> = {
  owner: "Owner",
  modifier: "Modifier",
  enthusiast: "Enthusiast",
  diy_mechanic: "DIY Mechanic",
  trader: "Trader",
};

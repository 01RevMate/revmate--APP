import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Versions of the documents people agree to at sign-up. Bump the date when
// the Terms or Privacy Policy change in a way people must re-accept; signed-in
// users are then asked to agree again (see ConsentGate).
export const TERMS_VERSION = "2026-09-28";
export const PRIVACY_VERSION = "2026-09-28";

/** Youngest age that can have an account (UK GDPR digital consent age). */
export const MIN_AGE = 13;

/** Features that unlock with age. Enforced by the database (0037). */
export const AGE_LIMITS = {
  selling: 18,
  meets: 18,
  location: 18,
  messages: 16,
} as const;

export function ageOn(birthDate: string, today = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export type AccountConsents = {
  birth_date: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  marketing_opt_in: boolean;
};

/**
 * The signed-in person's consent record. `available` is false until
 * 0037_age_and_consent.sql has run, in which case nothing is gated.
 */
export function useAccountConsents() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["account-consents", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<{ available: boolean; consents: AccountConsents | null }> => {
      const { data, error } = await supabase
        .from("account_consents")
        .select("birth_date, terms_version, privacy_version, marketing_opt_in")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return { available: false, consents: null };
      return { available: true, consents: data };
    },
  });
  return { ...query.data, isLoading: query.isLoading };
}

/**
 * The signed-in person's age, or null when unknown (not signed in, the SQL
 * hasn't run, or an older account that hasn't told us yet).
 */
export function useAccountAge(): number | null {
  const { consents } = useAccountConsents();
  return consents?.birth_date ? ageOn(consents.birth_date) : null;
}

/** True unless we know the person is younger than `years`. */
export function useOldEnough(years: number): boolean {
  const age = useAccountAge();
  return age === null || age >= years;
}

export async function recordConsents(input: {
  birthDate: string;
  marketing: boolean;
}): Promise<"ok" | "under_age"> {
  const { data, error } = await supabase.rpc("record_consents", {
    born: input.birthDate,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    marketing: input.marketing,
  });
  if (error) throw error;
  return data === "under_age" ? "under_age" : "ok";
}

export async function setMarketingConsent(optIn: boolean) {
  const { error } = await supabase.rpc("set_marketing_consent", { opt_in: optIn });
  if (error) throw error;
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
}

/**
 * Who runs RevMate, shown in the legal pages. UK law requires these to be
 * filled in: the business (or sole trader) name and address, the ICO data
 * protection registration number (https://ico.org.uk/fee), and a contact
 * email that's monitored. Blank values show as "[to be added]".
 */
export const OPERATOR = {
  name: "",
  address: "",
  icoRegistration: "",
  contactEmail: "",
};

export function operatorValue(value: string): string {
  return value.trim() || "[to be added]";
}

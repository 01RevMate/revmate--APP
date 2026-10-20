import { supabase } from "@/integrations/supabase/client";
import { useMoneySettings } from "@/lib/money";

// The AI step of "Fix a problem" (supabase/functions/diagnose). Members only,
// switched on by an admin, with daily limits enforced on the server.

export type AiCause = {
  name: string;
  likelihood: number;
  system: string;
  urgency: "stop" | "soon" | "monitor";
  cost_estimate: string;
  why: string;
  check: string;
};

export type AiResult = {
  next_question: { text: string; options: string[] } | null;
  causes: AiCause[];
  summary: string;
  safety_warning: string | null;
  confident: boolean;
  community_post: string;
};

export type AiRequest = {
  car: { make: string; model: string; year?: string; fuel?: string; mileage?: string } | null;
  /** What powers the car, when known. Electric rules out engine faults. */
  powertrain?: "petrol" | "diesel" | "hybrid" | "electric";
  area: string;
  answers: { question: string; answer: string }[];
  description?: string;
  followups: { question: string; answer: string }[];
  builtInGuess?: string[];
  commonIssues?: { title: string; reports: number; resolved: number }[];
};

export const MAX_AI_ROUNDS = 3;

/** True when an admin has switched AI diagnosis on. */
export function useAiDiagnosisEnabled(): boolean {
  return useMoneySettings()?.ai_diagnosis_enabled === true;
}

export async function askAi(req: AiRequest): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke<{ result?: AiResult; error?: string }>(
    "diagnose",
    { body: req },
  );
  if (error) {
    // The function's own message (limits, switched off…) is in the response body.
    const context = (error as { context?: Response }).context;
    const detail = context
      ? await context
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => null)
      : null;
    throw new Error(detail ?? "AI diagnosis isn't available right now.");
  }
  if (!data?.result) throw new Error(data?.error ?? "The AI didn't give a clear answer.");
  return data.result;
}

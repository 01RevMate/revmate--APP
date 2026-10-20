// AI step of "Fix a problem". Takes the built-in diagnosis so far (plus the
// driver's own words and what other owners of the model reported) and asks
// Claude either for one more narrowing question or for the likely causes.
//
//   POST { car, area, answers, description, followups, builtInGuess, commonIssues }
//   (signed-in members only) → { result } or { error }
//
// Each call uses one AI credit (public.ai_take_credit in
// 0066_diagnosis_and_shops.sql): off until an admin switches it on, with a
// per-member and a whole-site daily cap so the bill can't run away.
//
// Secrets: ANTHROPIC_API_KEY. Optional: DIAGNOSE_MODEL (default claude-opus-5-5).
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildUserMessage,
  RequestSchema,
  ResultSchema,
  SYSTEM_PROMPT,
  tidyResult,
} from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const model = Deno.env.get("DIAGNOSE_MODEL") || "claude-opus-5-5";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const anthropic = apiKey ? new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 }) : null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CREDIT_MESSAGES: Record<string, [number, string]> = {
  off: [503, "AI diagnosis isn't switched on yet."],
  user_limit: [429, "You've used today's AI diagnoses. Try again tomorrow, or ask the community."],
  global_limit: [429, "AI diagnosis is very busy today. Try again tomorrow, or ask the community."],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!anthropic) return json({ error: "AI diagnosis isn't set up yet." }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Log in to use AI diagnosis." }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Bad request" }, 400);
  const input = parsed.data;

  const { data: credit, error: creditError } = await admin.rpc("ai_take_credit", {
    p_user: user.id,
  });
  if (creditError) {
    console.error("diagnose credit", creditError.message);
    return json({ error: "AI diagnosis isn't available right now." }, 503);
  }
  if (credit !== "ok") {
    const [status, message] = CREDIT_MESSAGES[String(credit)] ?? [503, "Not available right now."];
    return json({ error: message }, status);
  }

  try {
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: 16000,
      // If Claude declines (safety classifiers), the API retries on its
      // recommended fallback model instead of returning a refusal.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Interactive, one step at a time on a phone: keep it quick.
      output_config: { effort: "low", format: betaZodOutputFormat(ResultSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "The AI couldn't help with this one. Try asking the community." }, 422);
    }
    if (!response.parsed_output) {
      console.error("diagnose: no parsed output", response.stop_reason);
      return json({ error: "The AI didn't give a clear answer. Try again." }, 502);
    }
    return json({ result: tidyResult(response.parsed_output, input.followups.length) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "AI diagnosis is busy. Try again in a minute." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("diagnose api", err.status, err.message);
    } else {
      console.error("diagnose", err);
    }
    return json({ error: "AI diagnosis isn't available right now." }, 502);
  }
});

import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.server";

export type CompatHost = { host_id: string; connector: string; kw: number; fits: string; notes: string | null };
export type DriverEv = { make: string; model: string; year: number | null; trim: string | null; spec: string | null } | null;

const schema = z.object({
  results: z.array(
    z.object({
      host_id: z.string(),
      verdict: z.enum(["likely", "check", "unlikely"]),
      explanation: z.string(),
      missing: z.array(z.string()),
    }),
  ),
});
export type CompatResult = z.infer<typeof schema>["results"][number];

export async function explainCompatibility(driverEv: DriverEv, hosts: CompatHost[]): Promise<CompatResult[]> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("AI is not configured");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions:
      "You help UK EV drivers judge whether a member's home charger suits their car. For each host, write one or two plain, friendly sentences (UK English, no jargon) on connector fit and likely charge speed (car's onboard AC limit vs host kW, and that home chargers are AC only). Never invent facts about the host. List anything unknown in `missing` (e.g. 'Your car isn't saved in your garage', 'Host hasn't said if a tethered cable is fitted', 'Exact onboard charger limit for your trim'). verdict: likely = should work, check = probably but unconfirmed, unlikely = probably won't work. Keep each explanation under 45 words.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          driver_car: driverEv ?? "not saved",
          connector_labels: { type2: "Type 2 socket or tethered cable", three_pin: "3-pin household plug", other: "other/unspecified" },
          fits_labels: { car: "driveway fits a car", van: "fits a van", small: "small space only", street: "street parking only" },
          hosts,
        }),
      },
    ],
    output: Output.object({ schema }),
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
  });
  const out = await result.output;
  return out.results;
}

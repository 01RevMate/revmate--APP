import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import { getChargerCompatibility } from "@/lib/chargerCompat.functions";
import type { NearbyHost } from "@/lib/communityChargers";

type CompatData = Awaited<ReturnType<typeof getChargerCompatibility>>;
export type CompatState = { data: CompatData | undefined; loading: boolean; failed: boolean };

export function useChargerCompat(hosts: NearbyHost[] | null): CompatState {
  const fn = useServerFn(getChargerCompatibility);
  const ids = (hosts ?? []).map((h) => h.host_id).join(",");
  const q = useQuery({
    queryKey: ["charger-compat", ids],
    enabled: !!hosts && hosts.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: () =>
      fn({ data: { hosts: hosts!.map((h) => ({ host_id: h.host_id, connector: h.connector, kw: h.kw, fits: h.fits, notes: h.notes })) } }),
  });
  return { data: q.data, loading: q.isLoading, failed: q.isError };
}

const VERDICT = {
  likely: { icon: CheckCircle2, label: "Looks compatible", cls: "text-primary" },
  check: { icon: HelpCircle, label: "Probably compatible — check", cls: "text-amber-500" },
  unlikely: { icon: XCircle, label: "May not be compatible", cls: "text-destructive" },
} as const;

/** hostId null = summary line shown once above the results. */
export function CompatibilityNote({ state, hostId }: { state: CompatState; hostId: string | null }) {
  if (hostId === null) {
    if (state.loading) return null;
    const msg = state.failed ? "Couldn't check compatibility right now." : state.data?.error;
    return (
      <p className="text-xs text-muted-foreground">
        {msg
          ? msg
          : state.data?.car
            ? `Compatibility notes are based on your ${state.data.car} and each host's details. AI-written — always confirm with the host before you travel.`
            : "Add your EV to your Garage for better compatibility notes. AI-written — always confirm with the host before you travel."}
      </p>
    );
  }
  if (state.loading)
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking compatibility with your car…
      </p>
    );
  const r = state.data?.results.find((x) => x.host_id === hostId);
  if (!r) return null;
  const v = VERDICT[r.verdict];
  const Icon = v.icon;
  return (
    <div className="mt-3 border-l-2 border-primary/40 pl-3 text-sm">
      <p className={`flex items-center gap-1.5 font-semibold ${v.cls}`}>
        <Icon className="h-4 w-4" /> {v.label}
      </p>
      <p className="mt-1 text-muted-foreground">{r.explanation}</p>
      {r.missing.length > 0 && (
        <div className="mt-1.5 text-xs">
          <p className="flex items-center gap-1 font-medium text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> Missing info</p>
          <ul className="ml-5 list-disc text-muted-foreground">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <p className="mt-1.5 text-xs font-medium">Confirm compatibility with the host before travelling.</p>
    </div>
  );
}

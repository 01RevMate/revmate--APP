import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  MessageCircleQuestion,
  RotateCcw,
  Search,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { CreatePostModal } from "@/components/CreatePostModal";
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";
import { fetchGarage } from "@/lib/garage";
import { fetchCommonIssues, issueSystemName } from "@/lib/diagnostics";
import {
  AREAS,
  diagnose,
  findArea,
  helpPostText,
  questionsFor,
  URGENCY_LABEL,
  type Answer,
  type Area,
  type Urgency,
} from "@/lib/diagnosis";
import {
  askAi,
  MAX_AI_ROUNDS,
  useAiDiagnosisEnabled,
  type AiCause,
  type AiResult,
} from "@/lib/aiDiagnosis";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/diagnose")({
  head: () =>
    seo({
      title: "What's wrong with my car? Free step-by-step diagnosis — RevMate",
      description:
        "Leaks, warning lights, noises, smoke or won't start: answer a few quick questions to find the likely cause, how urgent it is and a rough UK price.",
      path: "/diagnose",
    }),
  component: DiagnosePage,
});

type CarChoice = { make: string; model: string; year?: string; fuel?: string; mileage?: string };

// Which kind of business to suggest for each part of the car.
const MECHANIC_CATEGORY: Record<string, string> = {
  bodywork: "bodywork",
  tyres_wheels: "tyres",
};

const URGENCY_STYLE: Record<Urgency, string> = {
  stop: "bg-red-600 text-white",
  soon: "bg-amber-500 text-black",
  monitor: "bg-emerald-600 text-white",
};

function DiagnosePage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const aiEnabled = useAiDiagnosisEnabled();
  const [area, setArea] = useState<Area | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [car, setCar] = useState<CarChoice | null>(null);
  const [pickMake, setPickMake] = useState("");
  const [pickModel, setPickModel] = useState("");
  const [description, setDescription] = useState("");
  const [ai, setAi] = useState<AiResult | null>(null);
  const [followups, setFollowups] = useState<{ question: string; answer: string }[]>([]);
  const [asking, setAsking] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const myCars = (garage ?? []).filter((c) => c.ownership_status !== "previous" && c.make);

  const remaining = area ? questionsFor(area, answers) : [];
  const current = remaining.find((q) => !answers.some((a) => a.questionId === q.id)) ?? null;
  const step = area ? remaining.indexOf(current ?? remaining[remaining.length - 1]!) + 1 : 0;
  const result = useMemo(
    () => (area && !current ? diagnose(area, answers) : null),
    [area, current, answers],
  );

  const { data: commonIssues } = useQuery({
    queryKey: ["common-issues", car?.make, car?.model],
    enabled: !!car?.make && !!result,
    queryFn: () => fetchCommonIssues(car!.make, car!.model || null),
    staleTime: 10 * 60_000,
  });

  function reset() {
    setArea(null);
    setAnswers([]);
    setAi(null);
    setFollowups([]);
    setDescription("");
    window.scrollTo({ top: 0 });
  }

  function answer(questionId: string, optionId: string) {
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionId !== questionId),
      { questionId, optionId },
    ]);
  }

  function back() {
    if (ai || followups.length) {
      setAi(null);
      setFollowups([]);
      return;
    }
    if (answers.length === 0) {
      setArea(null);
      return;
    }
    setAnswers((prev) => prev.slice(0, -1));
  }

  async function runAi(nextFollowups: { question: string; answer: string }[]) {
    if (!result) return;
    if (!user) {
      openAuthModal("Create a free account to use AI diagnosis.");
      return;
    }
    setAsking(true);
    try {
      const res = await askAi({
        car: car?.make ? car : null,
        area: result.area.label,
        answers: result.answeredText,
        ...(description.trim() ? { description: description.trim() } : {}),
        followups: nextFollowups,
        builtInGuess: result.causes.map((c) => `${c.name} (${c.likelihood}%)`),
        commonIssues: (commonIssues ?? []).slice(0, 8).map((c) => ({
          title: `${issueSystemName(c.issue_system) ?? c.issue_system} problems`,
          reports: c.reports,
          resolved: c.resolved,
        })),
      });
      setFollowups(nextFollowups);
      setAi(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI diagnosis isn't available right now.");
    } finally {
      setAsking(false);
    }
  }

  const carLabel = car?.make ? [car.year, car.make, car.model].filter(Boolean).join(" ") : null;
  const topSystem = ai?.causes[0]?.system ?? result?.causes[0]?.system ?? area?.system ?? "other";
  const unsure = ai ? !ai.confident : (result?.confidence ?? 0) < 50;
  const mechanicCategory = MECHANIC_CATEGORY[topSystem];
  const postBody =
    ai?.community_post?.trim() || (result ? helpPostText(result, carLabel, description) : "");

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <div className="flex items-center gap-2">
        {area && (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="-ml-2 rounded-full p-2 hover:bg-accent"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight">Fix a problem</h1>
        {area && (
          <button
            type="button"
            onClick={reset}
            className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Start again
          </button>
        )}
      </div>

      {!area && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Answer a few quick questions and we'll narrow down what's likely wrong, how urgent it is
            and roughly what it costs.
          </p>

          <section className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Which car? (optional)
            </p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
              {myCars.map((c) => {
                const active = car?.make === c.make && car?.model === c.model;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCar(
                        active
                          ? null
                          : {
                              make: c.make,
                              model: c.model,
                              ...(c.year ? { year: String(c.year) } : {}),
                              ...(c.fuel_type ? { fuel: c.fuel_type } : {}),
                              ...(c.mileage ? { mileage: String(c.mileage) } : {}),
                            },
                      )
                    }
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}
                  >
                    🚗 {c.nickname || `${c.make} ${c.model}`}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MakeSelect
                value={pickMake}
                onChange={(v) => {
                  setPickMake(v);
                  setPickModel("");
                  setCar(v ? { make: v, model: "" } : null);
                }}
              />
              {pickMake ? (
                <ModelSelect
                  make={pickMake}
                  value={pickModel}
                  onChange={(v) => {
                    setPickModel(v);
                    setCar({ make: pickMake, model: v });
                  }}
                />
              ) : (
                <div />
              )}
            </div>
          </section>

          <h2 className="mt-6 text-lg font-bold">What's happening?</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setArea(findArea(a.id));
                  setAnswers([]);
                }}
                className="flex flex-col items-start gap-1 rounded-2xl border border-border bg-card p-3 text-left hover:bg-muted/50 active:scale-[0.98]"
              >
                <span className="text-2xl" aria-hidden>
                  {a.emoji}
                </span>
                <span className="font-semibold leading-tight">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.blurb}</span>
              </button>
            ))}
          </div>

          <Link
            to="/issues"
            className="mt-6 flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-muted/50"
          >
            <Search className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm">
              <span className="block font-semibold">Browse problems &amp; fixes</span>
              <span className="text-muted-foreground">
                What other owners had, and how they fixed it
              </span>
            </span>
          </Link>
        </>
      )}

      {area && current && (
        <section className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {area.emoji} {area.label} · Question {step} of {remaining.length}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((step - 1) / remaining.length) * 100}%` }}
            />
          </div>
          <h2 className="mt-4 text-xl font-bold">{current.text}</h2>
          {current.help && <p className="mt-1 text-sm text-muted-foreground">{current.help}</p>}
          <div className="mt-4 space-y-2">
            {current.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => answer(current.id, o.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left font-medium hover:bg-muted/50 active:scale-[0.99]"
              >
                {o.emoji && (
                  <span className="text-lg" aria-hidden>
                    {o.emoji}
                  </span>
                )}
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {result && (
        <section className="mt-5 space-y-4">
          {(result.dangers.length > 0 || ai?.safety_warning) && (
            <div className="flex gap-3 rounded-2xl bg-red-600 p-4 text-white">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Don't drive it until it's checked</p>
                {[
                  ...new Set([
                    ...result.dangers,
                    ...(ai?.safety_warning ? [ai.safety_warning] : []),
                  ]),
                ].map((d) => (
                  <p key={d} className="mt-0.5">
                    {d}
                  </p>
                ))}
              </div>
            </div>
          )}

          {ai?.next_question ? (
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                <Sparkles className="size-3.5" /> RevMate AI · question {followups.length + 1} of up
                to {MAX_AI_ROUNDS}
              </p>
              <h2 className="mt-2 text-lg font-bold">{ai.next_question.text}</h2>
              <div className="mt-3 space-y-2">
                {ai.next_question.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={asking}
                    onClick={() =>
                      void runAi([...followups, { question: ai.next_question!.text, answer: o }])
                    }
                    className="flex min-h-12 w-full items-center rounded-xl border border-border bg-card px-4 py-3 text-left font-medium hover:bg-muted/50 disabled:opacity-60"
                  >
                    {o}
                  </button>
                ))}
              </div>
              {asking && <p className="mt-2 text-sm text-muted-foreground">Thinking…</p>}
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold">
                  {ai ? "RevMate AI thinks it's most likely…" : "Most likely causes"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ai?.summary ||
                    (carLabel
                      ? `For your ${carLabel}, based on your answers.`
                      : "Based on your answers.")}
                </p>
              </div>
              {(ai ? ai.causes : result.causes).map((c, i) => (
                <CauseCard key={`${c.name}-${i}`} cause={toCard(c)} rank={i} ai={!!ai} car={car} />
              ))}
              {ai && ai.causes.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  The AI couldn't pin it down. Ask the community below.
                </p>
              )}
            </>
          )}

          {!ai && aiEnabled && (
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4">
              <p className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="size-4 text-violet-600" /> Narrow it down with RevMate AI
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe it in your own words (when it happens, sounds, smells, anything you've
                tried) and the AI will ask a couple more questions.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="e.g. Started after a cold night, only when the heater's on…"
                className="mt-3 w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={asking}
                onClick={() => void runAi([])}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                {asking ? "Thinking…" : user ? "Ask RevMate AI" : "Log in to ask RevMate AI"}
              </button>
            </div>
          )}

          <div
            className={`rounded-2xl border p-4 ${unsure ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <Users className="size-4" />
              {unsure ? "Not sure? Ask owners who've had it" : "Ask other owners"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll write the post for you from your answers. It goes in Problems &amp; fixes for{" "}
              {issueSystemName(topSystem)?.toLowerCase() ?? "this"}
              {carLabel ? ` on the ${carLabel}` : ""}, and you can mark it fixed later.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  user ? setPostOpen(true) : openAuthModal("Create a free account to ask owners.")
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <MessageCircleQuestion className="size-4" /> Ask the community
              </button>
              <Link
                to="/businesses"
                search={mechanicCategory ? { category: mechanicCategory } : {}}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold"
              >
                <Store className="size-4" /> Find a mechanic
              </Link>
            </div>
          </div>

          {car?.make && (commonIssues?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-border p-4">
              <p className="font-semibold">Common on the {carLabel}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {commonIssues!.slice(0, 5).map((c) => (
                  <li key={c.issue_system}>
                    <Link
                      to="/issues"
                      search={{
                        make: car.make,
                        ...(car.model ? { model: car.model } : {}),
                        system: c.issue_system,
                      }}
                      className="flex justify-between gap-2 hover:underline"
                    >
                      <span>{issueSystemName(c.issue_system) ?? c.issue_system}</span>
                      <span className="text-muted-foreground">
                        {c.reports} reported · {c.resolved} fixed
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This is a guide based on your answers, not a guarantee. Prices are rough UK garage
            prices including labour. If anything affects brakes, steering or tyres, or you're not
            sure it's safe, don't drive it — ask a mechanic or your breakdown cover.
          </p>

          <CreatePostModal
            open={postOpen}
            onOpenChange={setPostOpen}
            title="Ask other owners"
            initialBody={postBody}
            helpPost
            initialIssueSystem={topSystem}
            initialCarTag={
              car?.make
                ? { make: car.make, model: car.model, engine: "", year: car.year ?? "" }
                : undefined
            }
          />
        </section>
      )}
    </main>
  );
}

type CardCause = {
  name: string;
  likelihood: number;
  urgency: Urgency;
  cost: string;
  explain: string;
  check: string;
  system: string;
};

function toCard(c: AiCause | (CardCause & { prior?: number })): CardCause {
  if ("cost_estimate" in c) {
    return {
      name: c.name,
      likelihood: c.likelihood,
      urgency: c.urgency,
      cost: c.cost_estimate,
      explain: c.why,
      check: c.check,
      system: c.system,
    };
  }
  return c;
}

function CauseCard({
  cause,
  rank,
  ai,
  car,
}: {
  cause: CardCause;
  rank: number;
  ai: boolean;
  car: CarChoice | null;
}) {
  const urgency = URGENCY_LABEL[cause.urgency];
  return (
    <article
      className={`rounded-2xl border bg-card p-4 ${rank === 0 ? "border-primary/50 shadow-sm" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold leading-snug">
          {rank === 0 && <CheckCircle2 className="mr-1 inline size-4 align-[-2px] text-primary" />}
          {cause.name}
        </h3>
        <span className="shrink-0 text-sm font-bold tabular-nums">{cause.likelihood}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${cause.likelihood}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${URGENCY_STYLE[cause.urgency]}`}>
          {urgency.title}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
          Typically {cause.cost}
        </span>
        {ai && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="size-3" /> AI
          </span>
        )}
      </div>
      <p className="mt-3 text-sm">{cause.explain}</p>
      <p className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">
        <span className="font-semibold">Check yourself: </span>
        {cause.check}
      </p>
      <Link
        to="/issues"
        search={{
          system: cause.system,
          ...(car?.make ? { make: car.make } : {}),
          ...(car?.model ? { model: car.model } : {}),
        }}
        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
      >
        See how owners fixed {issueSystemName(cause.system)?.toLowerCase() ?? "this"} problems →
      </Link>
    </article>
  );
}

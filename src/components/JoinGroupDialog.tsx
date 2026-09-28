import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CommunityGroup, GroupQuestion } from "@/lib/groups";

/**
 * Facebook-style join screen: the group's rules to agree to plus its entry
 * questions. The database re-checks every answer in join_group().
 */
export function JoinGroupDialog({
  open,
  onOpenChange,
  group,
  questions,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CommunityGroup;
  questions: GroupQuestion[];
  busy: boolean;
  onSubmit: (answers: Record<string, string>, agreed: boolean) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setAgreed(false);
    }
  }, [open]);

  const needsAgreement = group.require_rules_agreement && !!group.rules?.trim();
  const complete =
    (!needsAgreement || agreed) &&
    questions.every((question) => {
      const answer = answers[question.id]?.trim();
      if (!answer) return false;
      return question.kind !== "agree" || answer === "yes";
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Join {group.name}</DialogTitle>
          <DialogDescription>
            {group.join_policy === "approval"
              ? "The group's moderators will see your answers when they review your request."
              : "Answer these to join straight away."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (complete) onSubmit(answers, agreed);
          }}
        >
          {needsAgreement && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Group rules</p>
              <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                {group.rules}
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="size-4 accent-primary"
                />
                I agree to the group rules
              </label>
            </div>
          )}
          {questions.map((question) => (
            <div key={question.id} className="space-y-1.5">
              {question.kind === "agree" ? (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={answers[question.id] === "yes"}
                    onChange={(e) =>
                      setAnswers({ ...answers, [question.id]: e.target.checked ? "yes" : "" })
                    }
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  {question.prompt}
                </label>
              ) : (
                <>
                  <p className="text-sm font-medium">{question.prompt}</p>
                  {question.kind === "yes_no" ? (
                    <div className="flex gap-2" role="radiogroup" aria-label={question.prompt}>
                      {(["yes", "no"] as const).map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          role="radio"
                          aria-checked={answers[question.id] === choice}
                          onClick={() => setAnswers({ ...answers, [question.id]: choice })}
                          className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize ${
                            answers[question.id] === choice
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:bg-accent"
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[question.id] ?? ""}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      maxLength={500}
                      rows={2}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <button
            disabled={!complete || busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Sending…"
              : group.join_policy === "approval"
                ? "Send join request"
                : "Join group"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

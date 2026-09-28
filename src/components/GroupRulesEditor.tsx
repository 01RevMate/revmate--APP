import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { GroupEntryRule, GroupQuestionDraft, GroupRulesDraft } from "@/lib/groups";

export type { GroupRulesDraft };

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/**
 * Entry gate, posting rules and join questions for a group. Used when the
 * group is made and again in the owner's settings, so anything chosen at
 * the start can be changed later.
 */
export function GroupRulesEditor({
  value,
  onChange,
  makeName,
  modelName,
}: {
  value: GroupRulesDraft;
  onChange: (next: GroupRulesDraft) => void;
  makeName: string | null;
  modelName: string | null;
}) {
  const set = (patch: Partial<GroupRulesDraft>) => onChange({ ...value, ...patch });
  const setQuestion = (index: number, patch: Partial<GroupQuestionDraft>) =>
    set({
      questions: value.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    });
  const move = (index: number, by: -1 | 1) => {
    const next = [...value.questions];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    set({ questions: next });
  };

  const options: { id: GroupEntryRule; label: string; hint: string; disabled: boolean }[] = [
    {
      id: "open",
      label: "Everyone",
      hint: "Free entry — no garage check.",
      disabled: false,
    },
    {
      id: "same_brand",
      label: makeName ? `${makeName} owners` : "Same brand",
      hint: makeName
        ? `Only people with a ${makeName} in their garage can join, and they post as that car.`
        : "Pick the group's car make first.",
      disabled: !makeName,
    },
    {
      id: "same_model",
      label: makeName && modelName ? `${makeName} ${modelName} owners` : "Same car",
      hint:
        makeName && modelName
          ? `Only ${makeName} ${modelName} owners can join, and they post as that car.`
          : "Pick the group's make and model first.",
      disabled: !makeName || !modelName,
    },
  ];

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium">Who can join?</legend>
        <p className="text-xs text-muted-foreground">We check their garage when they tap join.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${
                value.entry_rule === option.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="entry_rule"
                  value={option.id}
                  checked={value.entry_rule === option.id}
                  disabled={option.disabled}
                  onChange={() => set({ entry_rule: option.id })}
                  className="accent-primary"
                />
                {option.label}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <span className="text-sm">
          <span className="block font-medium">No sales or advertising</span>
          <span className="block text-xs text-muted-foreground">
            Blocks for-sale posts and listing links. Moderators can remove anything else that's
            selling.
          </span>
        </span>
        <input
          type="checkbox"
          checked={!value.allow_sales}
          onChange={(e) => set({ allow_sales: !e.target.checked })}
          className="mt-1 size-5 accent-primary"
        />
      </label>

      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Group rules
          <textarea
            value={value.rules_text}
            onChange={(e) => set({ rules_text: e.target.value })}
            maxLength={5000}
            rows={4}
            placeholder={
              "1. Be respectful\n2. No spam or self-promotion\n3. Keep it about the cars"
            }
            className={`mt-1 resize-y font-normal ${input}`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.require_rules_agreement}
            onChange={(e) => set({ require_rules_agreement: e.target.checked })}
            className="size-4 accent-primary"
          />
          People must agree to these rules to join
        </label>
      </div>

      <div>
        <p className="text-sm font-medium">Entry questions</p>
        <p className="text-xs text-muted-foreground">
          Asked when someone joins. Moderators see the answers with each request.
        </p>
        <ul className="mt-2 space-y-2">
          {value.questions.map((question, index) => (
            <li key={index} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <select
                  aria-label="Question type"
                  value={question.kind}
                  onChange={(e) =>
                    setQuestion(index, {
                      kind: e.target.value as GroupQuestionDraft["kind"],
                      required_answer: null,
                    })
                  }
                  className="rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  <option value="agree">Rule to agree to</option>
                  <option value="yes_no">Yes / no</option>
                  <option value="text">Written answer</option>
                </select>
                <div className="ml-auto flex">
                  <IconButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === value.questions.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Remove question"
                    onClick={() =>
                      set({ questions: value.questions.filter((_, i) => i !== index) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>
              <input
                value={question.prompt}
                onChange={(e) => setQuestion(index, { prompt: e.target.value })}
                maxLength={300}
                placeholder={
                  question.kind === "agree"
                    ? "e.g. I won't post anything for sale"
                    : question.kind === "yes_no"
                      ? "e.g. Are you 17 or over?"
                      : "e.g. What spec is your car?"
                }
                className={input}
              />
              {question.kind === "yes_no" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Only let people in who answer
                  <select
                    value={question.required_answer ?? ""}
                    onChange={(e) =>
                      setQuestion(index, {
                        required_answer: (e.target.value || null) as "yes" | "no" | null,
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">either</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
        {value.questions.length < 10 && (
          <button
            type="button"
            onClick={() =>
              set({
                questions: [
                  ...value.questions,
                  { kind: "agree", prompt: "", required_answer: null },
                ],
              })
            }
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm hover:bg-accent"
          >
            <Plus className="size-4" /> Add a question
          </button>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

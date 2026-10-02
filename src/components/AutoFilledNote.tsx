import { Wand2 } from "lucide-react";

/** "We filled in 9 details from your garage — check they're right." */
export function AutoFilledNote({ count }: { count: number }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
      <Wand2 className="mt-0.5 size-4 shrink-0" />
      <span>
        We filled in {count} {count === 1 ? "detail" : "details"} from your garage. Give them a
        quick check — anything blank is optional.
      </span>
    </p>
  );
}

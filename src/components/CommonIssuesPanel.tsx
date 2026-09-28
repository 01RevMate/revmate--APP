import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Stethoscope } from "lucide-react";
import { fetchCommonIssues, issueSystemLabel } from "@/lib/diagnostics";

/**
 * Problems RevMate members have reported for a make/model, grouped by part
 * of the car, with how many have a known fix. Taps through to the posts.
 */
export function CommonIssuesPanel({ make, model }: { make: string; model?: string | null }) {
  const { data: issues } = useQuery({
    queryKey: ["common-issues", make.toLowerCase(), model?.toLowerCase() ?? null],
    queryFn: () => fetchCommonIssues(make, model),
    staleTime: 5 * 60_000,
  });
  const name = [make, model].filter(Boolean).join(" ");

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Stethoscope className="size-4 text-primary" /> Known issues · {name}
      </h2>
      {!issues?.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No problems reported for the {name} yet. Got one? Post it in Diagnostics and the community
          can help.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {issues.map((issue) => (
            <li key={issue.issue_system}>
              <Link
                to="/issues"
                search={{ make, ...(model ? { model } : {}), system: issue.issue_system }}
                className="flex items-center gap-3 py-2.5 text-sm hover:text-primary"
              >
                <span className="flex-1 font-medium">{issueSystemLabel(issue.issue_system)}</span>
                <span className="text-xs text-muted-foreground">
                  {issue.reports} {issue.reports === 1 ? "report" : "reports"}
                </span>
                {issue.resolved > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3" /> {issue.resolved} fixed
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/issues"
        search={{ make, ...(model ? { model } : {}) }}
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
      >
        See all problems and fixes →
      </Link>
    </section>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  FileWarning,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { carLabel, carPath, fetchCars, setCarStatus, yearRange } from "@/lib/cars";
import { deletePost } from "@/lib/posts";
import {
  addProtectedTerm,
  deleteProtectedTerm,
  fetchAdminProfiles,
  fetchAdminReports,
  fetchGarageOwnerIds,
  fetchProtectedTerms,
  reviewReport,
  setProtectedTermActive,
  updateAccountAccess,
  updateProfileRole,
} from "@/lib/moderation";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (profile?.role !== "admin" || profile.account_status !== "active")
      throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Safety & Admin — RevMate" },
      { name: "description", content: "Moderate RevMate reports, accounts, protected terms and car pages." },
      { property: "og:title", content: "Safety & Admin — RevMate" },
      { property: "og:description", content: "Moderate RevMate reports, accounts, protected terms and car pages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type AdminSection = "reports" | "people" | "protect" | "cars";

function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AdminSection>("reports");
  const [reportFilter, setReportFilter] = useState<"open" | "all">("open");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newTermType, setNewTermType] = useState<"word" | "phrase">("phrase");

  const reportsQuery = useQuery({ queryKey: ["admin", "reports"], queryFn: fetchAdminReports });
  const profilesQuery = useQuery({ queryKey: ["admin", "profiles"], queryFn: fetchAdminProfiles });
  const garageOwnersQuery = useQuery({
    queryKey: ["admin", "garage-owner-ids"],
    queryFn: fetchGarageOwnerIds,
  });
  const termsQuery = useQuery({
    queryKey: ["admin", "protected-terms"],
    queryFn: fetchProtectedTerms,
  });
  const carsQuery = useQuery({ queryKey: ["cars", ""], queryFn: () => fetchCars() });

  const reportCountByAccount = useMemo(() => {
    const counts = new Map<string, { total: number; reporters: Set<string> }>();
    for (const report of reportsQuery.data ?? []) {
      const current = counts.get(report.reported_user_id) ?? {
        total: 0,
        reporters: new Set<string>(),
      };
      current.total += 1;
      current.reporters.add(report.reporter_id);
      counts.set(report.reported_user_id, current);
    }
    return counts;
  }, [reportsQuery.data]);

  const visibleReports = (reportsQuery.data ?? []).filter(
    (report) => reportFilter === "all" || report.status === "open",
  );
  const visibleProfiles = (profilesQuery.data ?? []).filter((profile) =>
    profile.username.toLowerCase().includes(peopleSearch.trim().toLowerCase()),
  );

  function refreshSafety() {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  async function changeAccess(
    userId: string,
    username: string,
    status: "active" | "banned" | "removed",
  ) {
    if (userId === user?.id && status !== "active") {
      toast.error("You cannot restrict your own admin account.");
      return false;
    }
    const action = status === "active" ? "restore" : status;
    const note =
      status === "active" ? "" : window.prompt(`Reason to ${action} ${displayUsernameWithoutAt(username)}:`)?.trim();
    if (status !== "active" && !note) return false;
    if (!window.confirm(`${action[0]!.toUpperCase()}${action.slice(1)} ${displayUsernameWithoutAt(username)}?`))
      return false;
    try {
      await updateAccountAccess(userId, status, note ?? "");
      refreshSafety();
      toast.success(`${displayUsernameWithoutAt(username)} is now ${status}.`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the account");
      return false;
    }
  }

  async function changeRole(userId: string, username: string, role: "user" | "admin") {
    if (userId === user?.id && role === "user") {
      toast.error("You cannot remove your own admin access.");
      return;
    }
    if (
      !window.confirm(
        `${role === "admin" ? "Make" : "Remove"} ${displayUsernameWithoutAt(username)} ${role === "admin" ? "an admin" : "from admins"}?`,
      )
    )
      return;
    try {
      await updateProfileRole(userId, role);
      refreshSafety();
      toast.success("Admin access updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update admin access");
    }
  }

  async function removeReportedPost(reportId: string, postId: string | null) {
    if (!postId || !window.confirm("Delete this reported post permanently?")) return;
    try {
      await deletePost(postId);
      await reviewReport(reportId, "actioned");
      refreshSafety();
      toast.success("Post deleted and report actioned.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the post");
    }
  }

  async function actionReportedAccount(
    reportId: string,
    userId: string,
    username: string,
    status: "banned" | "removed",
  ) {
    const changed = await changeAccess(userId, username, status);
    if (!changed) return;
    try {
      await reviewReport(reportId, "actioned");
      refreshSafety();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't close the report");
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!user || newTerm.trim().length < 2) return;
    try {
      await addProtectedTerm(user.id, newTerm, newTermType);
      setNewTerm("");
      queryClient.invalidateQueries({ queryKey: ["admin", "protected-terms"] });
      toast.success("Protection rule added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that rule");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Safety & Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review reports, protect the feed, manage accounts, and maintain car pages.
      </p>

      <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-3">
        {(
          [
            ["reports", "Reports", FileWarning],
            ["people", "People", UserCog],
            ["protect", "Protect Posts", Shield],
            ["cars", "Car pages", Car],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${section === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      {section === "reports" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Reported posts</h2>
              <p className="text-sm text-muted-foreground">
                Accounts with more than five reports are highlighted for review.
              </p>
            </div>
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value as typeof reportFilter)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="open">Open reports</option>
              <option value="all">All reports</option>
            </select>
          </div>
          {reportsQuery.isLoading && (
            <p className="mt-5 text-sm text-muted-foreground">Loading reports…</p>
          )}
          <div className="mt-5 space-y-4">
            {visibleReports.map((report) => {
              const accountReports = reportCountByAccount.get(report.reported_user_id);
              const escalation = (accountReports?.total ?? 0) > 5;
              const ownsCar = garageOwnersQuery.data?.has(report.reported_user_id) ?? false;
              return (
                <article
                  key={report.id}
                  className={`rounded-xl border bg-card p-5 ${escalation ? "border-amber-500/60" : "border-border"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                      {report.reason.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {report.status}
                    </span>
                    {ownsCar && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        Car owner
                      </span>
                    )}
                    {escalation && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3.5" /> Review account for removal
                      </span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {report.posts?.body ?? "This post has already been removed."}
                  </p>
                  {report.details && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Reporter note: {report.details}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                     Posted by {displayUsernameWithoutAt(report.reported_profile?.username, "unknown")} · reported by {displayUsernameWithoutAt(report.reporter?.username, "unknown")} · {accountReports?.total ?? 0} total
                    reports from {accountReports?.reporters.size ?? 0} people
                  </p>
                  {report.status === "open" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => removeReportedPost(report.id, report.post_id)}
                        disabled={!report.post_id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" /> Delete post
                      </button>
                      <button
                        onClick={() =>
                          actionReportedAccount(
                            report.id,
                            report.reported_user_id,
                            report.reported_profile?.username ?? "user",
                            "banned",
                          )
                        }
                        className="rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive"
                      >
                        Ban account
                      </button>
                      <button
                        onClick={() =>
                          actionReportedAccount(
                            report.id,
                            report.reported_user_id,
                            report.reported_profile?.username ?? "user",
                            "removed",
                          )
                        }
                        className="rounded-md border border-input px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        Remove profile
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await reviewReport(report.id, "dismissed");
                            refreshSafety();
                          } catch {
                            toast.error("Couldn't dismiss report");
                          }
                        }}
                        className="rounded-md border border-input px-3 py-2 text-xs hover:bg-accent"
                      >
                        Dismiss report
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!reportsQuery.isLoading && visibleReports.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No reports in this view.
            </div>
          )}
        </section>
      )}

      {section === "people" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">People & access</h2>
              <p className="text-sm text-muted-foreground">
                Ban, restore, remove, or grant admin access.
              </p>
            </div>
            <input
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              placeholder="Search username"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-5 divide-y divide-border rounded-xl border border-border">
            {visibleProfiles.map((profile) => {
              const count = reportCountByAccount.get(profile.user_id)?.total ?? 0;
              return (
                <div key={profile.user_id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-48 flex-1">
                    <Link
                      to="/u/$username"
                      params={{ username: profile.username }}
                      className="font-semibold hover:underline"
                    >
                       {displayUsernameWithoutAt(profile.username)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {profile.role} · {profile.account_status} · {count} reports ·{" "}
                      {garageOwnersQuery.data?.has(profile.user_id)
                        ? "owns a car"
                        : "no garage car"}
                    </p>
                    {profile.moderation_note && (
                      <p className="mt-1 text-xs text-destructive">
                        Admin note: {profile.moderation_note}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      changeRole(
                        profile.user_id,
                        profile.username,
                        profile.role === "admin" ? "user" : "admin",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs font-medium hover:bg-accent"
                  >
                    <ShieldCheck className="size-3.5" />{" "}
                    {profile.role === "admin" ? "Remove admin" : "Make admin"}
                  </button>
                  {profile.account_status === "active" ? (
                    <>
                      <button
                        onClick={() => changeAccess(profile.user_id, profile.username, "banned")}
                        className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive"
                      >
                        Ban
                      </button>
                      <button
                        onClick={() => changeAccess(profile.user_id, profile.username, "removed")}
                        className="rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-white"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => changeAccess(profile.user_id, profile.username, "active")}
                      className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Restore
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {section === "protect" && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Protect Posts</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Add words or phrases commonly used by spam accounts. RevMate blocks matching posts
            before publication. The normal word “sex” is not blocked by default; use specific spam
            language to avoid blocking legitimate car discussions.
          </p>
          <form
            onSubmit={addTerm}
            className="mt-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4"
          >
            <input
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              placeholder="Word or phrase to block"
              className="min-w-56 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={newTermType}
              onChange={(e) => setNewTermType(e.target.value as typeof newTermType)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="phrase">Phrase contains</option>
              <option value="word">Exact word</option>
            </select>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Add protection
            </button>
          </form>
          <div className="mt-5 divide-y divide-border rounded-xl border border-border">
            {termsQuery.data?.map((term) => (
              <div key={term.id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">{term.term}</p>
                  <p className="text-xs text-muted-foreground">
                    {term.match_type === "word" ? "Exact word" : "Phrase contains"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await setProtectedTermActive(term.id, !term.active);
                      queryClient.invalidateQueries({ queryKey: ["admin", "protected-terms"] });
                    } catch {
                      toast.error("Couldn't update protection");
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${term.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                >
                  {term.active ? "Active" : "Paused"}
                </button>
                <button
                  title="Delete rule"
                  onClick={async () => {
                    if (!window.confirm(`Delete the protection for “${term.term}”?`)) return;
                    try {
                      await deleteProtectedTerm(term.id);
                      queryClient.invalidateQueries({ queryKey: ["admin", "protected-terms"] });
                    } catch {
                      toast.error("Couldn't delete protection");
                    }
                  }}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {section === "cars" && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Car pages</h2>
          {carsQuery.isLoading && (
            <p className="mt-5 text-sm text-muted-foreground">Loading cars…</p>
          )}
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {carsQuery.data?.map((car) => (
              <li key={car.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Link {...carPath(car)} className="font-medium hover:underline">
                    {carLabel(car)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {yearRange(car)} · {car.body_type ?? "—"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await setCarStatus(
                        car.id,
                        car.status === "verified" ? "unverified" : "verified",
                      );
                      queryClient.invalidateQueries({ queryKey: ["cars"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Couldn't update car");
                    }
                  }}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {car.status === "verified" ? "Mark unverified" : "Mark verified"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

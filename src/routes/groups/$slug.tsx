import { useEffect, useState } from "react";
import { fetchGroupSeo } from "@/lib/seoData";
import { groupHead } from "@/lib/seoHeads";
import { useProfile } from "@/hooks/useProfile";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Car, Check, Clock3, Lock, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import {
  type CommunityGroup,
  carMatchesGroup,
  fetchEntryEligibility,
  fetchGroupBySlug,
  fetchGroupQuestions,
  fetchJoinAnswers,
  groupRuleLabel,
  joinGroup,
  saveGroupQuestions,
  fetchGroupReports,
  fetchGroupMembers,
  setGroupMemberRole,
  updateGroupSettings,
  fetchGroupPosts,
  fetchMyMembership,
  fetchPendingGroupMembers,
  leaveGroup,
  requestGroupMembership,
  setGroupMembershipStatus,
  setGroupPostStatus,
} from "@/lib/groups";
import { reviewReport } from "@/lib/moderation";
import { CarLogo } from "@/components/CarLogo";
import { fetchMyLikedPostIds } from "@/lib/posts";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import { displayUsernameWithoutAt } from "@/lib/usernames";
import { fetchGarage } from "@/lib/garage";
import { useGroupRulesFeature } from "@/lib/features";
import { JoinGroupDialog } from "@/components/JoinGroupDialog";
import { GroupRulesEditor, type GroupRulesDraft } from "@/components/GroupRulesEditor";
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";

export const Route = createFileRoute("/groups/$slug")({
  loader: ({ params }) => fetchGroupSeo(params.slug),
  head: ({ params, loaderData }) => groupHead(params.slug, loaderData ?? null),
  component: GroupPage,
});

function GroupPage() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const { isAdmin } = useProfile();
  const [busy, setBusy] = useState(false);
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, user, navigate]);
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: retryGroup,
  } = useQuery({
    queryKey: ["groups", slug, user?.id],
    queryFn: () => fetchGroupBySlug(slug),
  });
  const { data: membership } = useQuery({
    queryKey: ["groups", group?.id, "membership", user?.id],
    enabled: !!group && !!user,
    queryFn: () => fetchMyMembership(group!.id, user!.id),
  });
  const approved = membership?.status === "approved";
  const canModerate =
    isAdmin || (approved && ["owner", "admin", "moderator"].includes(membership.role));
  const canViewPosts =
    !!group &&
    membership?.status !== "banned" &&
    (group.visibility === "public" || approved || canModerate);
  const {
    data: posts,
    isLoading: postsLoading,
    error: postsError,
  } = useQuery({
    queryKey: ["groups", group?.id, "posts", user?.id],
    enabled: !!group && canViewPosts,
    queryFn: () => fetchGroupPosts(group!.id),
    refetchInterval: 240000,
  });
  const { data: pendingMembers } = useQuery({
    queryKey: ["groups", group?.id, "pending-members", user?.id],
    enabled: !!group && canModerate,
    queryFn: () => fetchPendingGroupMembers(group!.id),
  });
  const { data: reports, error: reportsError } = useQuery({
    queryKey: ["groups", group?.id, "reports", user?.id],
    enabled: !!group && canModerate,
    queryFn: () => fetchGroupReports(group!.id),
  });
  const { data: members, error: membersError } = useQuery({
    queryKey: ["groups", group?.id, "members", user?.id],
    enabled: !!group && canModerate,
    queryFn: () => fetchGroupMembers(group!.id),
  });
  const groupRules = useGroupRulesFeature();
  const ruleLabel = group && groupRules ? groupRuleLabel(group) : null;
  const [joinOpen, setJoinOpen] = useState(false);
  const { data: questions } = useQuery({
    queryKey: ["groups", group?.id, "questions"],
    enabled: !!group && groupRules,
    queryFn: () => fetchGroupQuestions(group!.id),
  });
  const { data: eligibility } = useQuery({
    queryKey: ["groups", group?.id, "eligibility", user?.id, group?.entry_rule],
    enabled: !!group && !!user && !membership && !!ruleLabel,
    queryFn: () => fetchEntryEligibility(group!.id),
  });
  const { data: joinAnswers } = useQuery({
    queryKey: ["groups", group?.id, "join-answers", user?.id],
    enabled: !!group && canModerate && groupRules && (pendingMembers?.length ?? 0) > 0,
    queryFn: () => fetchJoinAnswers(group!.id),
  });
  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user && approved && !!ruleLabel && !canModerate,
    queryFn: () => fetchGarage(user!.id),
  });
  // In a same-brand / same-car group members post as a matching car only.
  const matchingCars = group ? (garage ?? []).filter((car) => carMatchesGroup(car, group)) : [];
  const { data: likedIds } = useQuery({
    queryKey: ["groups", group?.id, "liked", user?.id, posts?.map((post) => post.id)],
    enabled: !!user && !!posts?.length,
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((post) => post.id),
      ),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  async function join() {
    if (busy) return;
    if (!user) return openAuthModal("Create a free account to join this group.");
    if (!group) return;
    if (eligibility && !eligibility.eligible) {
      toast.error(eligibility.reason ?? "You can't join this group yet.");
      return;
    }
    const hasEntryForm =
      groupRules &&
      ((questions?.length ?? 0) > 0 || (group.require_rules_agreement && !!group.rules.trim()));
    if (hasEntryForm) {
      setJoinOpen(true);
      return;
    }
    await submitJoin({}, false);
  }

  async function submitJoin(answers: Record<string, string>, agreed: boolean) {
    if (!user || !group) return;
    try {
      setBusy(true);
      const result = groupRules
        ? await joinGroup(group.id, user.id, answers, agreed)
        : await requestGroupMembership(group.id, user.id);
      setJoinOpen(false);
      refresh();
      toast.success(result?.status === "approved" ? "You joined the group." : "Join request sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join group");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!user || !group || membership?.role === "owner") return;
    try {
      await leaveGroup(group.id, user.id);
      refresh();
      toast.success("You left the group.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave group");
    }
  }

  async function reviewMember(id: string, status: "approved" | "rejected" | "banned") {
    try {
      if (!group) return;
      await setGroupMembershipStatus(group.id, id, status);
      refresh();
      toast.success(
        status === "approved"
          ? "Member approved."
          : status === "banned"
            ? "Member banned."
            : "Request rejected.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update member");
    }
  }

  async function reviewPost(id: string, status: "published" | "rejected") {
    try {
      await setGroupPostStatus(id, status);
      refresh();
      toast.success(status === "published" ? "Post approved." : "Post rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update post");
    }
  }

  if (groupError)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="alert">Could not load this group. Please try again.</p>
        <button onClick={() => retryGroup()} className="mt-3 text-primary">
          Try again
        </button>
      </main>
    );
  if (isLoading)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Loading group…
      </main>
    );
  if (!group)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p>Group not found.</p>
        <Link to="/groups" className="mt-3 inline-block text-sm text-primary hover:underline">
          Browse groups
        </Link>
      </main>
    );
  const pendingPosts = (posts ?? []).filter((post) => post.moderation_status === "pending");
  const visiblePosts = (posts ?? []).filter(
    (post) => post.moderation_status === "published" || post.user_id === user?.id,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All groups
      </Link>
      <section className="mt-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {group.make_name && <CarLogo make={group.make_name} className="size-12 rounded-xl" />}
              <h1 className="text-2xl font-semibold">{group.name}</h1>
              {group.visibility === "private" && <Lock className="size-4 text-muted-foreground" />}
            </div>
            {(group.make_name || group.model_name) && (
              <p className="mt-1 text-sm font-medium text-primary">
                {[group.make_name, group.model_name].filter(Boolean).join(" ")}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {group.description || "A RevMate community group."}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" /> {group.member_count}{" "}
              {group.member_count === 1 ? "member" : "members"}
            </p>
            {groupRules && (ruleLabel || group.allow_sales === false) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ruleLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Car className="size-3.5" /> {ruleLabel} owners only
                  </span>
                )}
                {group.allow_sales === false && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Ban className="size-3.5" /> No sales posts
                  </span>
                )}
              </div>
            )}
          </div>
          {!membership && (
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={join}
                disabled={busy || eligibility?.eligible === false}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {group.join_policy === "approval" ? "Request to join" : "Join group"}
              </button>
              {eligibility?.eligible === false && (
                <p className="max-w-60 text-right text-xs text-muted-foreground">
                  {eligibility.reason}{" "}
                  <Link to="/garage" className="font-medium text-primary hover:underline">
                    Go to garage
                  </Link>
                </p>
              )}
            </div>
          )}
          {membership?.status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-300">
              <Clock3 className="size-4" /> Awaiting approval
            </span>
          )}
          {(approved || membership?.status === "pending") && membership?.role !== "owner" && (
            <button
              onClick={leave}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            >
              {membership?.status === "pending" ? "Cancel request" : "Leave group"}
            </button>
          )}
          {membership?.role === "owner" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" /> Owner
            </span>
          )}
        </div>
      </section>

      {canModerate && ((pendingMembers?.length ?? 0) > 0 || pendingPosts.length > 0) && (
        <section className="mt-5 space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div>
            <h2 className="font-semibold">Moderator queue</h2>
            <p className="text-xs text-muted-foreground">
              Approve people and posts before they enter the group.
            </p>
          </div>
          {pendingMembers?.map((member) => (
            <div key={member.id} className="rounded-md bg-background p-3">
              <div className="flex items-center gap-3">
                <Avatar
                  photoUrl={member.profiles?.avatar_url}
                  fallback={member.profiles?.username}
                  className="size-8"
                />
                <span className="flex-1 text-sm font-medium">
                  {displayUsernameWithoutAt(member.profiles?.username, "Member")}
                </span>
                <button
                  onClick={() => reviewMember(member.user_id, "approved")}
                  title="Approve"
                  className="rounded-md bg-primary p-2 text-primary-foreground"
                >
                  <Check className="size-4" />
                </button>
                <button
                  onClick={() => reviewMember(member.user_id, "rejected")}
                  title="Reject"
                  className="rounded-md border border-input p-2"
                >
                  <X className="size-4" />
                </button>
              </div>
              {joinAnswers?.[member.user_id] && (
                <dl className="mt-2 space-y-1.5 border-t pt-2 text-xs">
                  {joinAnswers[member.user_id]!.agreed_rules && (
                    <p className="text-muted-foreground">✓ Agreed to the group rules</p>
                  )}
                  {joinAnswers[member.user_id]!.answers.map((answer) => (
                    <div key={answer.question_id}>
                      <dt className="text-muted-foreground">{answer.prompt}</dt>
                      <dd className="font-medium">
                        {answer.kind === "agree"
                          ? "✓ Agreed"
                          : answer.kind === "yes_no"
                            ? answer.answer === "yes"
                              ? "Yes"
                              : "No"
                            : answer.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
          {pendingPosts.map((post) => (
            <div key={post.id} className="rounded-md bg-background p-3">
              <p className="text-sm">{post.body}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {post.post_images
                  .filter((image) => image.image_url)
                  .map((image) => (
                    <img
                      key={image.id}
                      src={image.image_url}
                      alt="Post attachment for moderation"
                      className="rounded object-cover"
                    />
                  ))}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => reviewPost(post.id, "published")}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  Approve post
                </button>
                <button
                  onClick={() => reviewPost(post.id, "rejected")}
                  className="rounded-md border border-input px-3 py-1.5 text-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {canModerate && (
        <section className="mt-5 space-y-3">
          {reportsError && (
            <p role="alert">
              Could not load group reports. <button onClick={refresh}>Retry</button>
            </p>
          )}
          {!!reports?.length && <h2 className="font-semibold">Reported posts</h2>}
          {reports?.map((report) => (
            <div key={report.id} className="rounded-lg border border-destructive/30 p-4">
              <p className="text-xs font-semibold uppercase text-destructive">
                {report.reason.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-sm">{report.posts.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{report.details}</p>
              <div className="mt-3 flex gap-3">
                <button
                  disabled={busy}
                  className="text-sm text-destructive"
                  onClick={async () => {
                    if (!report.post_id) return;
                    setBusy(true);
                    try {
                      await setGroupPostStatus(report.post_id, "rejected");
                      await reviewReport(report.id, "actioned");
                      refresh();
                    } catch {
                      toast.error("Could not resolve this report.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Hide post and resolve
                </button>
                <button
                  disabled={busy}
                  className="text-sm text-muted-foreground"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await reviewReport(report.id, "dismissed");
                      refresh();
                    } catch {
                      toast.error("Could not dismiss this report.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Dismiss report
                </button>
              </div>
            </div>
          ))}
          {(posts ?? []).some((post) => post.moderation_status === "rejected") && (
            <details className="rounded-lg border p-4">
              <summary>Hidden posts</summary>
              {posts
                ?.filter((post) => post.moderation_status === "rejected")
                .map((post) => (
                  <div key={post.id} className="mt-3 border-t pt-3">
                    <p className="text-sm">{post.body}</p>
                    <button
                      onClick={() => reviewPost(post.id, "published")}
                      className="mt-2 text-sm text-primary"
                    >
                      Restore post
                    </button>
                  </div>
                ))}
            </details>
          )}
        </section>
      )}
      {group.rules && (
        <section className="mt-5 rounded-xl border border-border p-4">
          <h2 className="font-semibold">Group rules</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{group.rules}</p>
        </section>
      )}
      {canModerate && (
        <details className="mt-5 rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">Manage members and rules</summary>
          {membersError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Could not load members. Please reload.
            </p>
          )}
          {(membership?.role === "owner" || isAdmin) && (
            <GroupSettingsForm group={group} groupRules={groupRules} onSaved={refresh} />
          )}
          {members
            ?.filter((m) => m.status !== "pending")
            .map((member) => {
              const ranks: Record<string, number> = {
                owner: 4,
                admin: 3,
                moderator: 2,
                member: 1,
              };
              const canManage =
                member.role !== "owner" &&
                (isAdmin ||
                  (membership && (ranks[membership.role] ?? 0) > (ranks[member.role] ?? 0)));
              return (
                <div
                  key={member.id}
                  className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm"
                >
                  <span className="mr-auto">
                    {displayUsernameWithoutAt(member.profiles?.username, "Member")} · {member.role}{" "}
                    · {member.status}
                  </span>
                  {canManage &&
                    (membership?.role === "owner" || isAdmin) &&
                    member.status === "approved" && (
                      <select
                        aria-label={`Role for ${displayUsernameWithoutAt(member.profiles?.username, "member")}`}
                        value={member.role}
                        onChange={async (e) => {
                          try {
                            await setGroupMemberRole(
                              group.id,
                              member.user_id,
                              e.target.value as "admin" | "moderator" | "member",
                            );
                            refresh();
                          } catch {
                            toast.error("Could not change role.");
                          }
                        }}
                        className="rounded-md border bg-background p-2"
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  {canManage && (
                    <button
                      className="rounded-md border px-3 py-2"
                      onClick={() =>
                        reviewMember(
                          member.user_id,
                          member.status === "banned" || member.status === "rejected"
                            ? "approved"
                            : "banned",
                        )
                      }
                    >
                      {member.status === "banned" || member.status === "rejected"
                        ? "Approve member"
                        : "Ban member"}
                    </button>
                  )}
                </div>
              );
            })}
        </details>
      )}
      {membership?.status === "banned" && (
        <p className="mt-4 text-sm text-destructive">
          You have been removed from this group by a moderator.
        </p>
      )}
      {membership?.status === "rejected" && (
        <p className="mt-4 text-sm text-muted-foreground">Your join request was declined.</p>
      )}
      {approved && ruleLabel && !canModerate && garage && matchingCars.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-sm">
          <Car className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 font-medium">Posts here are made as your {ruleLabel}</p>
          <p className="mt-1 text-muted-foreground">
            There's no {ruleLabel} in your garage right now.{" "}
            <Link to="/garage" className="font-medium text-primary hover:underline">
              Go to garage
            </Link>
          </p>
        </div>
      )}
      {approved && (!ruleLabel || canModerate || matchingCars.length > 0) && (
        <div className="mt-5">
          <PostComposer
            onPosted={refresh}
            lockedGroup={{
              id: group.id,
              name: group.name,
              postPolicy: group.post_policy as "member" | "moderated",
            }}
            requiredCarIdentity={!!ruleLabel && !canModerate}
            garageCars={matchingCars}
            carIdentityNote={
              ruleLabel
                ? `This is a ${ruleLabel} group, so you post as your ${ruleLabel}.`
                : undefined
            }
          />
        </div>
      )}
      {joinOpen && (
        <JoinGroupDialog
          open={joinOpen}
          onOpenChange={setJoinOpen}
          group={group}
          questions={questions ?? []}
          busy={busy}
          onSubmit={(answers, agreed) => void submitJoin(answers, agreed)}
        />
      )}
      {!canViewPosts ? (
        <div className="mt-5 rounded-xl border border-dashed border-border p-10 text-center">
          <Lock className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Private group</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved members can see and take part in discussions.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={likedIds?.has(post.id) ?? false}
              onDeleted={refresh}
              canModerate={canModerate}
              onHide={() => reviewPost(post.id, "rejected")}
            />
          ))}
          {postsLoading && <p className="text-sm text-muted-foreground">Loading discussions…</p>}
          {postsError && (
            <p role="alert" className="text-sm text-destructive">
              Could not load posts. <button onClick={refresh}>Try again</button>
            </p>
          )}
          {!postsLoading && !postsError && visiblePosts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No approved posts yet.
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function GroupSettingsForm({
  group,
  groupRules,
  onSaved,
}: {
  group: CommunityGroup;
  groupRules: boolean;
  onSaved: () => void;
}) {
  const { data: questions } = useQuery({
    queryKey: ["groups", group.id, "questions"],
    enabled: groupRules,
    queryFn: () => fetchGroupQuestions(group.id),
  });
  const [postPolicy, setPostPolicy] = useState(group.post_policy);
  const [joinPolicy, setJoinPolicy] = useState(group.join_policy);
  const [makeName, setMakeName] = useState(group.make_name ?? "");
  const [modelName, setModelName] = useState(group.model_name ?? "");
  const [draft, setDraft] = useState<GroupRulesDraft>({
    entry_rule: (group.entry_rule ?? "open") as GroupRulesDraft["entry_rule"],
    allow_sales: group.allow_sales ?? true,
    require_rules_agreement: group.require_rules_agreement ?? false,
    rules_text: group.rules,
    questions: [],
  });
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!questions || questionsLoaded) return;
    setDraft((current) => ({
      ...current,
      questions: questions.map((question) => ({
        kind: question.kind as "agree" | "yes_no" | "text",
        prompt: question.prompt,
        required_answer: question.required_answer as "yes" | "no" | null,
      })),
    }));
    setQuestionsLoaded(true);
  }, [questions, questionsLoaded]);

  useEffect(() => {
    if (
      (draft.entry_rule !== "open" && !makeName) ||
      (draft.entry_rule === "same_model" && !modelName)
    ) {
      setDraft((current) => ({ ...current, entry_rule: makeName ? "same_brand" : "open" }));
    }
  }, [makeName, modelName, draft.entry_rule]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateGroupSettings(group.id, {
        rules: draft.rules_text,
        post_policy: postPolicy === "moderated" ? "moderated" : "member",
        ...(groupRules
          ? {
              join_policy:
                group.visibility === "private" || joinPolicy === "approval" ? "approval" : "open",
              make_name: makeName || null,
              model_name: makeName ? modelName || null : null,
              entry_rule: draft.entry_rule,
              allow_sales: draft.allow_sales,
              require_rules_agreement: draft.require_rules_agreement,
            }
          : {}),
      });
      if (groupRules && questionsLoaded) await saveGroupQuestions(group.id, draft.questions);
      onSaved();
      toast.success("Group settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save group settings.");
    } finally {
      setSaving(false);
    }
  }

  const select = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal";
  return (
    <form className="mt-4 space-y-4" onSubmit={save}>
      {groupRules && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Car make</label>
            <div className="mt-1">
              <MakeSelect
                value={makeName}
                onChange={(value) => {
                  setMakeName(value);
                  setModelName("");
                }}
              />
            </div>
          </div>
          {makeName && (
            <div>
              <label className="text-sm font-medium">Model</label>
              <div className="mt-1">
                <ModelSelect make={makeName} value={modelName} onChange={setModelName} />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {groupRules && (
          <label className="text-sm font-medium">
            Joining
            <select
              value={group.visibility === "private" ? "approval" : joinPolicy}
              disabled={group.visibility === "private"}
              onChange={(e) => setJoinPolicy(e.target.value)}
              className={`${select} disabled:opacity-60`}
            >
              <option value="open">Anyone who passes the rules</option>
              <option value="approval">Moderator approval</option>
            </select>
          </label>
        )}
        <label className="text-sm font-medium">
          New posts
          <select
            value={postPolicy}
            onChange={(e) => setPostPolicy(e.target.value)}
            className={select}
          >
            <option value="member">Publish immediately</option>
            <option value="moderated">Approve first</option>
          </select>
        </label>
      </div>
      {groupRules ? (
        <GroupRulesEditor
          value={draft}
          onChange={setDraft}
          makeName={makeName || null}
          modelName={modelName || null}
        />
      ) : (
        <label className="block text-sm">
          Group rules
          <textarea
            value={draft.rules_text}
            onChange={(e) => setDraft({ ...draft, rules_text: e.target.value })}
            maxLength={5000}
            className="mt-1 w-full rounded-md border bg-background p-2"
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Changing the entry rule doesn't remove existing members — ban anyone who no longer fits.
      </p>
      <button
        disabled={saving}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

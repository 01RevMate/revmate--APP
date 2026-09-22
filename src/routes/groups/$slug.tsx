import { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock3, Lock, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import {
  fetchGroupBySlug,
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
import { displayUsername } from "@/lib/usernames";

export const Route = createFileRoute("/groups/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — RevMate` }] }),
  component: GroupPage,
});

function GroupPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const [busy, setBusy] = useState(false);
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
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
    try {
      setBusy(true);
      const result = await requestGroupMembership(group.id, user.id);
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
          </div>
          {!membership && (
            <button
              onClick={join}
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {group.join_policy === "approval" ? "Request to join" : "Join group"}
            </button>
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
            <div key={member.id} className="flex items-center gap-3 rounded-md bg-background p-3">
              <Avatar
                photoUrl={member.profiles?.avatar_url}
                fallback={member.profiles?.username}
                className="size-8"
              />
              <span className="flex-1 text-sm font-medium">
                {displayUsername(member.profiles?.username, "Member")}
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
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await updateGroupSettings(group.id, {
                    rules: String(form.get("rules")),
                    post_policy: form.get("post_policy") === "moderated" ? "moderated" : "member",
                  });
                  refresh();
                  toast.success("Rules saved.");
                } catch {
                  toast.error("Could not save group rules.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm">
                Group rules
                <textarea
                  name="rules"
                  defaultValue={group.rules}
                  maxLength={5000}
                  className="mt-1 w-full rounded-md border bg-background p-2"
                />
              </label>
              <label className="block text-sm">
                New posts
                <select
                  name="post_policy"
                  defaultValue={group.post_policy}
                  className="ml-2 rounded-md border bg-background p-2"
                >
                  <option value="member">Publish immediately</option>
                  <option value="moderated">Approve first</option>
                </select>
              </label>
              <button
                disabled={busy}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                Save rules
              </button>
            </form>
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
                    {displayUsername(member.profiles?.username, "Member")} · {member.role} · {member.status}
                  </span>
                  {canManage &&
                    (membership?.role === "owner" || isAdmin) &&
                    member.status === "approved" && (
                      <select
                        aria-label={`Role for ${displayUsername(member.profiles?.username, "member")}`}
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
      {approved && (
        <div className="mt-5">
          <PostComposer
            onPosted={refresh}
            lockedGroup={{
              id: group.id,
              name: group.name,
              postPolicy: group.post_policy as "member" | "moderated",
            }}
          />
        </div>
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

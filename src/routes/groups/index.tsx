import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { createGroup, fetchGroups, fetchMyGroups } from "@/lib/groups";
import { CarLogo } from "@/components/CarLogo";
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";

export const Route = createFileRoute("/groups/")({
  head: () => ({
    meta: [
      { title: "Groups — RevMate" },
      { name: "description", content: "Find and create RevMate groups for makes, models and car communities." },
      { property: "og:title", content: "Groups — RevMate" },
      { property: "og:description", content: "Find and create RevMate groups for makes, models and car communities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user, loading } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, user, navigate]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("discover");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval">("open");
  const [postPolicy, setPostPolicy] = useState<"member" | "moderated">("member");
  const [makeName, setMakeName] = useState("");
  const [modelName, setModelName] = useState("");

  const {
    data: groups,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["groups", "directory"], queryFn: fetchGroups });
  const { data: memberships } = useQuery({
    queryKey: ["groups", "mine", user?.id],
    queryFn: () => fetchMyGroups(user!.id),
    enabled: !!user,
  });
  const visibleGroups = (groups ?? []).filter((group) => {
    const membership = memberships?.find((m) => m.group_id === group.id);
    return (
      (tab === "discover" ||
        (tab === "joined" ? !!membership : !!membership && membership.role !== "member")) &&
      `${group.name} ${group.description} ${group.make_name ?? ""} ${group.model_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return openAuthModal("Create a free account to start a group.");
    setSaving(true);
    try {
      const group = await createGroup(user.id, {
        name,
        description,
        visibility,
        join_policy: visibility === "private" ? "approval" : joinPolicy,
        post_policy: postPolicy,
        make_name: makeName || undefined,
        model_name: modelName || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created.");
      navigate({ to: "/groups/$slug", params: { slug: group.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community groups</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Join focused communities with their own moderators, membership rules, and discussions.
          </p>
        </div>
        <button
          onClick={() =>
            user
              ? setCreating((value) => !value)
              : openAuthModal("Create a free account to start a group.")
          }
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> Create group
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div>
            <label className="text-sm font-medium">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={80}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">What is this group for?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Car make (optional)</label>
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
                <label className="text-sm font-medium">Model (optional)</label>
                <div className="mt-1">
                  <ModelSelect make={makeName} value={modelName} onChange={setModelName} />
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Joining
              <select
                value={visibility === "private" ? "approval" : joinPolicy}
                disabled={visibility === "private"}
                onChange={(e) => setJoinPolicy(e.target.value as typeof joinPolicy)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal disabled:opacity-60"
              >
                <option value="open">Anyone can join</option>
                <option value="approval">Moderator approval</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              New posts
              <select
                value={postPolicy}
                onChange={(e) => setPostPolicy(e.target.value as typeof postPolicy)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-normal"
              >
                <option value="member">Publish immediately</option>
                <option value="moderated">Approve first</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        <div className="flex gap-2" role="tablist" aria-label="Group directory">
          {["discover", "joined", "managing"].map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-2 text-sm capitalize ${tab === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {value}
            </button>
          ))}
        </div>
        <input
          aria-label="Search groups"
          placeholder="Find a make, model, local club or interest…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Private groups appear in this directory; only approved members can read their posts. Post
          as yourself or your car inside a group.
        </p>
      </div>
      {error && (
        <div role="alert" className="mt-6 rounded-lg border p-4 text-sm">
          Groups could not be loaded.{" "}
          <button onClick={() => refetch()} className="text-primary">
            Try again
          </button>
        </div>
      )}
      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading groups…</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleGroups.map((group) => (
          <Link
            key={group.id}
            to="/groups/$slug"
            params={{ slug: group.slug }}
            className="rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {group.make_name ? (
                  <CarLogo make={group.make_name} className="size-9" />
                ) : (
                  <Users className="size-5" />
                )}
              </div>
              {group.visibility === "private" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> Private
                </span>
              )}
            </div>
            <h2 className="mt-4 font-semibold">{group.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {group.description || "A RevMate community group."}
            </p>
            {(group.make_name || group.model_name) && (
              <p className="mt-3 text-xs font-medium text-primary">
                {[group.make_name, group.model_name].filter(Boolean).join(" ")}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {group.member_count} {group.member_count === 1 ? "member" : "members"}
            </p>
          </Link>
        ))}
      </div>
      {!isLoading && !error && visibleGroups.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {tab === "discover"
            ? "No matching groups. Try another search or start a group."
            : user
              ? "You have no groups in this section yet."
              : "Sign in to see your groups."}
        </div>
      )}
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { updateProfile } from "@/lib/profiles";
import { carLabel, carPath, type Car } from "@/lib/cars";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { fetchBlockedProfiles, unblockProfile } from "@/lib/moderation";
import { displayUsername, normalizeUsername } from "@/lib/usernames";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — RevMate" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) setUsername(profile.username);
  }, [profile]);

  const savedCars = useQuery({
    queryKey: ["saved-cars", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_cars")
        .select("id, cars(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const blockedProfiles = useQuery({
    queryKey: ["blocked-profiles", user?.id],
    enabled: !!user,
    queryFn: () => fetchBlockedProfiles(user!.id),
  });

  async function handleUnblock(blockedId: string, username: string) {
    if (
      !user ||
      !window.confirm(`Unblock ${displayUsername(username)}? They will be able to find and contact you again.`)
    )
      return;
    try {
      await unblockProfile(user.id, blockedId);
      await queryClient.invalidateQueries({ queryKey: ["blocked-profiles", user.id] });
      queryClient.invalidateQueries({ queryKey: ["user-block", user.id, blockedId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success(`${displayUsername(username)} has been unblocked.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unblock this profile");
    }
  }

  async function handleUsernameSave(e: React.FormEvent) {
    e.preventDefault();
    const nextUsername = normalizeUsername(username);
    if (!user || !nextUsername) return;
    setSavingUsername(true);
    try {
      await updateProfile(user.id, { username: nextUsername });
      setUsername(nextUsername);
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["profile-by-username"] });
      toast.success("Username updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update username — it may already be taken",
      );
    } finally {
      setSavingUsername(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) return;
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    toast.success("Password updated");
  }

  if (loading) {
    return <p className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            Log in
          </Link>{" "}
          to manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      {profile && (
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="mt-2 inline-block text-sm underline"
        >
          View my public profile
        </Link>
      )}

      <Section title="Username">
        <form onSubmit={handleUsernameSave} className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingUsername}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingUsername ? "Saving…" : "Save"}
          </button>
        </form>
        <p className="mt-1 text-xs text-muted-foreground">
          This is also your public profile URL: revmate.app/u/{normalizeUsername(username) || "…"}
        </p>
      </Section>

      <Section title="Password">
        <form onSubmit={handlePasswordSave} className="flex gap-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            minLength={6}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingPassword || !newPassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingPassword ? "Saving…" : "Update"}
          </button>
        </form>
      </Section>

      <Section title="Blocking">
        <div className="mb-4 flex gap-3 rounded-lg bg-muted/50 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            People you block cannot message you, add you as a friend, or show their posts in your
            feed. They are not notified when you block or unblock them.
          </p>
        </div>

        {blockedProfiles.isLoading && (
          <p className="text-sm text-muted-foreground">Loading blocked people…</p>
        )}
        {blockedProfiles.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">Blocked people could not be loaded.</p>
            <button
              onClick={() => blockedProfiles.refetch()}
              className="mt-2 text-sm font-medium underline"
            >
              Try again
            </button>
          </div>
        )}
        {blockedProfiles.data && blockedProfiles.data.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {blockedProfiles.data.map((block) => {
              const blocked = block.blocked_profile;
              const username = blocked?.username ?? "Unavailable profile";
              return (
                <li key={block.id} className="flex items-center gap-3 p-3">
                  <Avatar
                    photoUrl={blocked?.avatar_url}
                    fallback={blocked?.username}
                    className="size-10"
                  />
                  <div className="min-w-0 flex-1">
                    {blocked ? (
                      <Link
                        to="/u/$username"
                        params={{ username: blocked.username }}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {displayUsername(blocked.username)}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold">{username}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Blocked profile</p>
                  </div>
                  <button
                    onClick={() => handleUnblock(block.blocked_id, username)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    <UserX className="size-4" /> Unblock
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {blockedProfiles.data?.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            You haven’t blocked anyone.
          </p>
        )}
      </Section>

      <Section title="Saved cars">
        <ul className="space-y-2">
          {savedCars.data?.map((row) => {
            const car = row.cars as Car | null;
            if (!car) return null;
            return (
              <li key={row.id} className="rounded-lg border border-border p-3">
                <Link {...carPath(car)} className="text-sm font-medium hover:underline">
                  {carLabel(car)}
                </Link>
              </li>
            );
          })}
          {savedCars.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No saved cars yet.{" "}
              <Link to="/cars" className="underline">
                Browse cars
              </Link>
            </li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

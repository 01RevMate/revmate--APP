import { createFileRoute, Link } from "@tanstack/react-router";
import { PRIMARY_HOST } from "@/lib/siteDomains";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  CarFront,
  ChevronRight,
  CreditCard,
  Info,
  Lock,
  MessageSquareHeart,
  ShieldCheck,
  ShoppingBag,
  SunMoon,
  UserRound,
  UserX,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { updateProfile } from "@/lib/profiles";
import { carLabel, carPath, type Car } from "@/lib/cars";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { HomeModeSwitch } from "@/components/HomeModeSwitch";
import { HeadlightDial } from "@/components/HeadlightDial";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { BillingSettings } from "@/components/BillingSettings";
import { AdsConsentSetting } from "@/components/AdsConsent";
import { useMoneyFeature, useMoneySettings } from "@/lib/money";
import { usePaidReturn } from "@/hooks/usePaidReturn";
import { useLaunchKitFeature } from "@/lib/launch";
import { useEngagementFeatures, usePushFeature } from "@/lib/features";
import { NotificationSettingsForm } from "@/components/NotificationSettingsForm";
import { PrivacyDataSettings } from "@/components/PrivacyDataSettings";
import { APP_VERSION } from "@/lib/changelog";
import { fetchBlockedProfiles, unblockProfile } from "@/lib/moderation";
import { displayUsernameWithoutAt, normalizeUsername } from "@/lib/usernames";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): { section?: string } =>
    typeof search["section"] === "string" && search["section"]
      ? { section: search["section"].slice(0, 30) }
      : {},
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Settings — RevMate" },
      {
        name: "description",
        content: "Manage your RevMate profile, password, blocked people and saved cars.",
      },
      { property: "og:title", content: "Settings — RevMate" },
      {
        property: "og:description",
        content: "Manage your RevMate profile, password, blocked people and saved cars.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { section } = Route.useSearch();
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const pushAvailable = usePushFeature();
  const engagement = useEngagementFeatures();
  const feedbackOn = useLaunchKitFeature();
  const moneyOn = useMoneyFeature();
  const moneySettings = useMoneySettings();
  usePaidReturn("Payment done. Thank you!", []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
      !window.confirm(
        `Unblock ${displayUsernameWithoutAt(username)}? They will be able to find and contact you again.`,
      )
    )
      return;
    try {
      await unblockProfile(user.id, blockedId);
      await queryClient.invalidateQueries({ queryKey: ["blocked-profiles", user.id] });
      queryClient.invalidateQueries({ queryKey: ["user-block", user.id, blockedId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success(`${displayUsernameWithoutAt(username)} has been unblocked.`);
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

  const sections: SettingsItem[] = [
    { id: "business", group: "Account", title: "My business", blurb: "Business profile, photos and reviews", icon: Store, content: <Link to="/businesses/manage" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><Store className="size-4" /> Add or manage your business <ChevronRight className="size-4" /></Link> },
    {
      id: "account",
      group: "Account",
      title: "Account",
      blurb: "Username and password",
      icon: UserRound,
      content: (
        <>
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
              This is also your public profile URL: {PRIMARY_HOST}/u/
              {normalizeUsername(username).replace(/^@/, "") || "…"}
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
        </>
      ),
    },
    ...(moneyOn
      ? [
          {
            id: "billing",
            group: "Account",
            title: "Plus & billing",
            blurb: "Plus, payments and receipts",
            icon: CreditCard,
            content: (
              <Section>
                <BillingSettings />
                {moneySettings?.shop_url && (
                  <a
                    href={moneySettings.shop_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold"
                  >
                    <ShoppingBag className="size-4" /> {moneySettings.shop_label}
                  </a>
                )}
              </Section>
            ),
          },
        ]
      : []),
    {
      id: "cars",
      group: "Account",
      title: "Saved cars",
      blurb: "Cars you've saved to look at later",
      icon: CarFront,
      content: (
        <Section>
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
      ),
    },
    ...(pushAvailable || engagement
      ? [
          {
            id: "notifications",
            group: "Preferences",
            title: "Notifications",
            blurb: "Alerts and quiet hours",
            icon: Bell,
            content: (
              <>
                {pushAvailable && (
                  <Section title="Phone notifications">
                    <PushNotificationToggle userId={user.id} />
                  </Section>
                )}
                {engagement && (
                  <Section title="What you hear about">
                    <NotificationSettingsForm userId={user.id} />
                  </Section>
                )}
              </>
            ),
          },
        ]
      : []),
    {
      id: "display",
      group: "Preferences",
      title: "Display & home screen",
      blurb: "Day/night mode and start page",
      icon: SunMoon,
      content: (
        <>
          <Section title="Appearance">
            <HeadlightDial />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Turn the dial or tap a symbol: sun for day, AUTO to match your phone, moon for night.
            </p>
          </Section>
          <Section title="Home screen">
            <HomeModeSwitch />
            <p className="mt-2 text-xs text-muted-foreground">
              Community shows the feed and stories. Essentials shows the practical side: buying and
              selling, parts, help and research.
            </p>
          </Section>
        </>
      ),
    },
    {
      id: "privacy",
      group: "Privacy & safety",
      title: "Privacy & your data",
      blurb: "Your area, ads and your data",
      icon: Lock,
      content: (
        <Section>
          <PrivacyDataSettings userId={user.id} email={user.email} />
          <div className="mt-4">
            <AdsConsentSetting />
          </div>
        </Section>
      ),
    },
    {
      id: "blocking",
      group: "Privacy & safety",
      title: "Blocking",
      blurb: blockedProfiles.data?.length
        ? `${blockedProfiles.data.length} blocked`
        : "People you've blocked",
      icon: UserX,
      content: (
        <Section>
          <div className="mb-4 flex gap-3 rounded-lg bg-muted/50 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              People you block cannot message you, follow you, or show their posts in your feed.
              They are not notified when you block or unblock them.
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
                          {displayUsernameWithoutAt(blocked.username)}
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
      ),
    },
    ...(feedbackOn
      ? [
          {
            id: "feedback",
            group: "Help & about",
            title: "Send feedback",
            blurb: "Report a bug or ask for a feature",
            icon: MessageSquareHeart,
            content: (
              <Section>
                <p className="mb-3 text-sm text-muted-foreground">
                  Spotted a bug or want something added? Tell us. We read every message.
                </p>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <MessageSquareHeart className="size-4" /> Send feedback
                </button>
                <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
              </Section>
            ),
          },
        ]
      : []),
    {
      id: "about",
      group: "Help & about",
      title: "About & legal",
      blurb: `Terms, privacy, safety · version ${APP_VERSION}`,
      icon: Info,
      content: (
        <Section>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/legal/terms" className="text-primary underline">
                Terms of service & marketplace disclaimer
              </Link>
            </li>
            <li>
              <Link to="/legal/privacy" className="text-primary underline">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/legal/cookies" className="text-primary underline">
                Cookie policy
              </Link>
            </li>
            <li>
              <Link to="/legal/safety" className="text-primary underline">
                Safety &amp; reporting
              </Link>
            </li>
            <li>
              <Link to="/community-standards" className="text-primary underline">
                Community standards
              </Link>
            </li>
            <li>
              <Link to="/legal/updates" className="text-primary underline">
                App updates
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">RevMate version {APP_VERSION}</p>
        </Section>
      ),
    },
  ];

  const open = sections.find((item) => item.id === section);
  if (open) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-10">
        <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:border-0 sm:px-0">
          <Link
            to="/settings"
            aria-label="Back to settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-lg font-bold">{open.title}</h1>
        </header>
        {open.content}
      </div>
    );
  }

  const groups = [...new Set(sections.map((item) => item.group))];
  return (
    <div className="mx-auto max-w-xl px-4 py-5 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      {profile && (
        <Link
          to="/u/$username"
          params={{ username: profile.username }}
          className="mt-4 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border"
        >
          <Avatar photoUrl={profile.avatar_url} fallback={profile.username} className="size-12" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {displayUsernameWithoutAt(profile.username)}
            </span>
            <span className="block truncate text-sm text-muted-foreground">{user.email}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary">View profile</span>
        </Link>
      )}

      {groups.map((group) => (
        <section key={group} className="mt-6">
          <h2 className="px-1 text-sm font-bold text-muted-foreground">{group}</h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
            {sections
              .filter((item) => item.group === group)
              .map((item) => (
                <li key={item.id}>
                  <Link
                    to="/settings"
                    search={{ section: item.id }}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <item.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{item.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {item.blurb}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type SettingsItem = {
  id: string;
  group: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  content: React.ReactNode;
};

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first-of-type:mt-4">
      {title && <h2 className="mb-3 text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

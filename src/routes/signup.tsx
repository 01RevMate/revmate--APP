import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { BirthDateSelect } from "@/components/BirthDateSelect";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/lib/authRedirect";
import { normalizeUsername, usernameLookupCandidates } from "@/lib/usernames";
import { AGE_LIMITS, ageOn, MIN_AGE, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/signup")({
  // ?redirect=/battles sends people back to what they were trying to open.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search["redirect"]);
    return redirect ? { redirect } : {};
  },
  head: () =>
    seo({
      title: "Join RevMate — free UK car community & marketplace",
      description:
        "Create a free RevMate account: build your garage, join car groups and meets, get help with faults and buy or sell cars and parts.",
      path: "/signup",
    }),
  component: SignupPage,
});

type Step = "birthday" | "account" | "username" | "agree" | "blocked" | "sent";
const STEPS: Step[] = ["birthday", "account", "username", "agree"];

// Someone told they're too young shouldn't be able to go straight back and
// pick an older birthday (ICO age-assurance guidance).
const AGE_BLOCK_KEY = "revmate:age-blocked-until";

function readAgeBlock(): boolean {
  try {
    return Number(localStorage.getItem(AGE_BLOCK_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function passwordProblems(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (/^(.)\1+$/.test(password)) return "Don't use one repeated character.";
  if (/^(password|12345678|qwerty|revmate)/i.test(password))
    return "That password is too easy to guess.";
  return null;
}

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [step, setStep] = useState<Step>("birthday");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (readAgeBlock()) setStep("blocked");
  }, []);

  function goOn() {
    if (redirect) router.history.push(redirect);
    else navigate({ to: "/garage" });
  }

  const age = birthDate ? ageOn(birthDate) : null;
  const handle = normalizeUsername(username);
  const passwordIssue = password ? passwordProblems(password) : null;

  function submitBirthday(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate || age === null || age > 120) {
      toast.error("Enter your real date of birth.");
      return;
    }
    if (age < MIN_AGE) {
      try {
        localStorage.setItem(AGE_BLOCK_KEY, String(Date.now() + 24 * 3600_000));
      } catch {
        // Private browsing: the database still refuses under-13 sign-ups.
      }
      setStep("blocked");
      return;
    }
    setStep("account");
  }

  function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (passwordIssue) return;
    setStep("username");
  }

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!/^@[A-Za-z0-9_.]{3,30}$/.test(handle)) {
      toast.error("Use 3–30 letters, numbers, dots or underscores.");
      return;
    }
    setCheckingName(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .in("username", usernameLookupCandidates(handle))
      .limit(1);
    setCheckingName(false);
    if (data?.length) {
      toast.error(`${handle} is taken — try another.`);
      return;
    }
    setStep("agree");
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeTerms || !agreePrivacy || !birthDate) return;
    setSaving(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + (redirect ?? ""),
        data: {
          username: handle,
          birth_date: birthDate,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          marketing_opt_in: marketing,
        },
      },
    });
    setSaving(false);
    if (error) {
      toast.error(
        /13 or older/i.test(error.message)
          ? `RevMate is for people ${MIN_AGE} and over.`
          : error.message,
      );
      return;
    }
    if (data.session) {
      goOn();
      return;
    }
    setStep("sent");
  }

  const stepIndex = STEPS.indexOf(step);
  const back = stepIndex > 0 ? () => setStep(STEPS[stepIndex - 1]!) : null;
  const input = "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <Link to="/" aria-label="RevMate home" className="mx-auto block w-fit">
        <BrandLogo className="h-20 w-40" />
      </Link>

      {stepIndex >= 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2">
            {back ? (
              <button
                type="button"
                onClick={back}
                aria-label="Back"
                className="-ml-2 rounded-full p-2 hover:bg-accent"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <span className="size-8" />
            )}
            <div
              className="flex flex-1 gap-1.5"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "birthday" && (
        <form onSubmit={submitBirthday} className="mt-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">When's your birthday?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We use this to keep RevMate right for your age. It won't be shown on your profile.
            </p>
          </div>
          <BirthDateSelect onChange={setBirthDate} />
          <Button type="submit" className="w-full" disabled={!birthDate}>
            Next
          </Button>
        </form>
      )}

      {step === "account" && (
        <form onSubmit={submitAccount} className="mt-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your email and password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll send a link to confirm it's you.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className={input}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
            <span
              className={`block text-xs ${passwordIssue ? "text-destructive" : "text-muted-foreground"}`}
            >
              {passwordIssue ??
                (password.length >= 12
                  ? "Strong length — nice."
                  : "At least 8 characters. Three random words make a strong password.")}
            </span>
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={!email || !password || !!passwordIssue}
          >
            Next
          </Button>
        </form>
      )}

      {step === "username" && (
        <form onSubmit={submitUsername} className="mt-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pick a username</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This is how people find you. You can change it later.
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Username</span>
            <input
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={31}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. m3_dan"
              className={input}
            />
            {handle.length > 1 && (
              <span className="block text-xs text-muted-foreground">
                Your profile: revmate.app/u/{handle.slice(1)}
              </span>
            )}
          </label>
          <Button type="submit" className="w-full" disabled={checkingName || handle.length < 4}>
            {checkingName ? "Checking…" : "Next"}
          </Button>
        </form>
      )}

      {step === "agree" && (
        <form onSubmit={createAccount} className="mt-6 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Nearly there</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Please read and agree to how RevMate works.
            </p>
          </div>
          <ul className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {[
              "Be respectful. No harassment, hate, scams or illegal content — we remove it and may ban accounts.",
              "RevMate connects buyers and sellers but isn't part of any sale. Always check a car before paying.",
              "Your date of birth and email stay private. You can download or delete your data any time in Settings.",
            ].map((point) => (
              <li key={point} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {age !== null && age < 18 && (
            <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-medium">Because you're under 18</span>, selling on Buy &amp;
                Sell, hosting meets and adding your location to posts unlock at {AGE_LIMITS.selling}
                {age < AGE_LIMITS.messages
                  ? `, and direct messages unlock at ${AGE_LIMITS.messages}`
                  : ""}
                . Never meet someone from the internet alone.
              </p>
            </div>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              I agree to the{" "}
              <Link to="/legal/terms" target="_blank" className="font-medium underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/community-standards" target="_blank" className="font-medium underline">
                Community Standards
              </Link>
              , and I'm {MIN_AGE} or older. <span className="text-destructive">*</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              I've read the{" "}
              <Link to="/legal/privacy" target="_blank" className="font-medium underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/legal/cookies" target="_blank" className="font-medium underline">
                Cookie Policy
              </Link>{" "}
              and understand how RevMate uses my information.{" "}
              <span className="text-destructive">*</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="text-muted-foreground">
              Optional: email me RevMate news, new features and offers. You can unsubscribe any
              time.
            </span>
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={saving || !agreeTerms || !agreePrivacy}
          >
            {saving ? "Creating account…" : "Agree and create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Required
          </p>
        </form>
      )}

      {step === "blocked" && (
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sorry, you can't join yet</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            RevMate is for people aged {MIN_AGE} and over. You can still browse the feed and Buy
            &amp; Sell without an account.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
            Back to RevMate
          </Link>
        </div>
      )}

      {step === "sent" && (
        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We've sent a confirmation link to {email}. Tap it to finish creating your account.
          </p>
        </div>
      )}

      {stepIndex >= 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" search={redirect ? { redirect } : {}} className="font-medium underline">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}

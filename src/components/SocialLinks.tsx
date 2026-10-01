import { useState } from "react";
import { CheckCircle2, ExternalLink, Facebook, Ghost, Instagram, Youtube } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  normaliseSocial,
  SOCIAL_PLATFORMS,
  socialHandle,
  useExtraSocialsFeature,
  type Profile,
  type SocialPlatform,
  type SocialPlatformKey,
} from "@/lib/profiles";

const BRAND: Record<SocialPlatformKey, string> = {
  social_instagram: "bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white",
  social_tiktok: "bg-black text-white",
  social_youtube: "bg-[#ff0000] text-white",
  social_facebook: "bg-[#1877f2] text-white",
  social_snapchat: "bg-[#fffc00] text-black",
  social_x: "bg-black text-white",
};

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.59-2.6 2.6 2.6 0 0 1 3.4-2.47V9.68a5.68 5.68 0 0 0-.81-.06A5.69 5.69 0 0 0 4.18 15.3 5.69 5.69 0 0 0 9.87 21a5.69 5.69 0 0 0 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.26-1.48Z" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

export function SocialIcon({
  platform,
  className = "size-4",
}: {
  platform: SocialPlatformKey;
  className?: string;
}) {
  switch (platform) {
    case "social_instagram":
      return <Instagram className={className} />;
    case "social_tiktok":
      return <TikTokGlyph className={className} />;
    case "social_youtube":
      return <Youtube className={className} />;
    case "social_facebook":
      return <Facebook className={className} />;
    case "social_snapchat":
      return <Ghost className={className} />;
    case "social_x":
      return <XGlyph className={className} />;
  }
}

/** Brand-coloured buttons under a profile's bio, with a "leaving RevMate" check. */
export function SocialLinksDisplay({ profile }: { profile: Profile }) {
  const [leaving, setLeaving] = useState<{ platform: SocialPlatform; url: string } | null>(null);
  const active = SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = (profile as Record<string, unknown>)[platform.key];
    return typeof url === "string" && url.startsWith("https://") ? [{ platform, url }] : [];
  });
  if (active.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {active.map(({ platform, url }) => (
          <button
            key={platform.key}
            type="button"
            onClick={() => setLeaving({ platform, url })}
            aria-label={`${platform.label}: ${socialHandle(url) ?? "profile"}`}
            className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-xs font-semibold shadow-sm transition-transform hover:scale-[1.03] active:scale-95 ${BRAND[platform.key]}`}
          >
            <SocialIcon platform={platform.key} className="size-4" />
            <span className="max-w-[9rem] truncate">{socialHandle(url) ?? platform.label}</span>
          </button>
        ))}
      </div>
      <Dialog open={!!leaving} onOpenChange={(open) => !open && setLeaving(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
          {leaving && (
            <>
              <DialogHeader>
                <span
                  className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${BRAND[leaving.platform.key]}`}
                >
                  <SocialIcon platform={leaving.platform.key} className="size-7" />
                </span>
                <DialogTitle className="text-center">
                  Open {socialHandle(leaving.url) ?? "their profile"} on {leaving.platform.label}?
                </DialogTitle>
                <DialogDescription className="text-center">
                  You're leaving RevMate. We don't check other sites — never share passwords or pay
                  anyone you meet there.
                </DialogDescription>
              </DialogHeader>
              <p className="truncate rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                {leaving.url.replace(/^https:\/\/(www\.)?/, "")}
              </p>
              <a
                href={leaving.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={() => setLeaving(null)}
                className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold ${BRAND[leaving.platform.key]}`}
              >
                Open {leaving.platform.label} <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setLeaving(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Stay on RevMate
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SocialLinksEditor({
  values,
  onChange,
}: {
  values: Partial<Record<SocialPlatformKey, string>>;
  onChange: (key: SocialPlatformKey, value: string) => void;
}) {
  const extra = useExtraSocialsFeature();
  const platforms = SOCIAL_PLATFORMS.filter((p) => extra || !p.extra);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Your socials</legend>
      <p className="text-xs text-muted-foreground">
        Type your username or paste a link. They show as buttons on your profile.
      </p>
      {platforms.map((platform) => {
        const value = values[platform.key] ?? "";
        const ok = value.trim() ? normaliseSocial(platform, value) : null;
        return (
          <label key={platform.key} className="flex items-center gap-2">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${BRAND[platform.key]}`}
              title={platform.label}
            >
              <SocialIcon platform={platform.key} className="size-[18px]" />
            </span>
            <span
              className={`flex min-w-0 flex-1 items-center rounded-md border bg-background text-sm focus-within:ring-2 focus-within:ring-ring ${value.trim() && !ok ? "border-destructive" : "border-input"}`}
            >
              <span className="hidden shrink-0 pl-3 text-muted-foreground sm:inline">
                {platform.prefix}
              </span>
              <input
                value={value}
                onChange={(e) => onChange(platform.key, e.target.value)}
                placeholder={`${platform.label} username`}
                aria-label={`${platform.label} username or link`}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none sm:pl-0.5"
              />
              {ok && <CheckCircle2 className="mr-2 size-4 shrink-0 text-emerald-600" />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

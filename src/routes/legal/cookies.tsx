import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { AdsConsentSetting } from "@/components/AdsConsent";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cookies")({
  head: () =>
    seo({
      title: "Cookie Policy — RevMate",
      description:
        "RevMate uses no analytics cookies, and ad cookies only if you allow them. Here's the small amount of storage we use to keep you signed in and remember your settings.",
      path: "/legal/cookies",
    }),
  component: CookiesPage,
});

const STORAGE: { name: string; purpose: string }[] = [
  { name: "Sign-in session", purpose: "Keeps you logged in securely (strictly necessary)." },
  { name: "Home mode", purpose: "Remembers whether you chose Community or Essentials." },
  {
    name: "Buy & Sell",
    purpose: "Your last visit (to mark new listings) and recently viewed listings.",
  },
  { name: "Near you distance", purpose: "Remembers the search radius you picked." },
  { name: "Sidebar", purpose: "Remembers if you collapsed the menu on desktop." },
  { name: "Map choice", purpose: "Remembers if you asked to always show maps on meets." },
  { name: "Age check", purpose: "Stops sign-up being retried straight away after an age check." },
  { name: "Ad cookies answer", purpose: "Remembers whether you allowed TikTok ad cookies." },
  {
    name: "Offline app files",
    purpose: "Lets the app open quickly and receive notifications if you turn them on.",
  },
];

function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="19 October 2026"
      intro={
        <p>
          <strong>
            RevMate doesn't use analytics cookies, and only uses ad cookies if you say yes.
          </strong>{" "}
          Otherwise we only store what's needed to run the app and remember choices you make, which
          UK law (PECR) allows without asking.
        </p>
      }
    >
      <section>
        <h2>What we store on your device</h2>
        <p>
          These use your browser's local storage rather than cookies, and never leave your device
          except your sign-in session:
        </p>
        <ul>
          {STORAGE.map((item) => (
            <li key={item.name}>
              <strong>{item.name}:</strong> {item.purpose}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Third parties</h2>
        <p>
          Maps on meet pages come from Google, which may set its own cookies. They only load after
          you tap "Show map". Our hosting provider, Cloudflare, may set a strictly necessary
          security cookie to protect the site from attacks.
        </p>
      </section>
      <section>
        <h2>TikTok ad cookies (optional)</h2>
        <p>
          We advertise RevMate on TikTok. If you tap <strong>Allow</strong> when we ask, we load the
          TikTok Pixel, which sets cookies so TikTok can tell us which ads led people to visit or
          sign up, and can use that to show RevMate ads to people like you. It never loads if you
          say no, and never for accounts belonging to under-18s. TikTok's own privacy policy applies
          to what it collects.
        </p>
        <div className="mt-3">
          <AdsConsentSetting />
        </div>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can clear this storage at any time in your browser settings, or clear your map choice
          in <Link to="/settings">Settings → Privacy</Link>. Clearing it will log you out and reset
          your preferences. You can change your ad cookies answer above or in Settings → Privacy.
        </p>
      </section>
    </LegalPage>
  );
}

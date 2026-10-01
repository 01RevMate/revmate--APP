import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { AGE_LIMITS, MIN_AGE, OPERATOR, operatorValue } from "@/lib/legal";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/privacy")({
  head: () =>
    seo({
      title: "Privacy Policy — RevMate",
      description:
        "How RevMate collects, uses and protects your personal information under UK GDPR, and how to access, download or delete your data.",
      path: "/legal/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="28 September 2026"
      intro={
        <p>
          This policy explains what personal information RevMate collects, why, who we share it with
          and the rights you have under UK data protection law (the UK GDPR and the Data Protection
          Act 2018). The short version: we only collect what we need to run RevMate, we never sell
          your data, and you can download or delete it at any time in{" "}
          <Link to="/settings" className="font-medium underline">
            Settings
          </Link>
          .
        </p>
      }
    >
      <section>
        <h2>1. Who we are</h2>
        <p>
          RevMate is run by {operatorValue(OPERATOR.name)}, {operatorValue(OPERATOR.address)} (the
          "data controller"). ICO registration number: {operatorValue(OPERATOR.icoRegistration)}.
          Contact us about privacy at {operatorValue(OPERATOR.contactEmail)}.
        </p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> email address, password (stored only as a secure
            hash), username and date of birth. Your date of birth is private and never shown to
            anyone.
          </li>
          <li>
            <strong>What you choose to share:</strong> profile photo, cover photo, bio, social
            links, garage cars, mods, posts, comments, reactions, photos, videos, stories, polls,
            listings, meets, group memberships and entry answers.
          </li>
          <li>
            <strong>Messages</strong> you send to other members.
          </li>
          <li>
            <strong>Location — only when you choose:</strong> if you add a location to a post or use
            "Near you", we use your device's location, rounded to about 1 km. We never track your
            location in the background.
          </li>
          <li>
            <strong>Activity:</strong> follows, likes, saves, watchlists, profile and listing views
            (counted once a day), streaks and notification settings.
          </li>
          <li>
            <strong>Safety records:</strong> reports you make or that are made about your content,
            blocks, and moderation decisions.
          </li>
          <li>
            <strong>Car care:</strong> MOT and road tax due dates you add, so we can remind you.
          </li>
          <li>
            <strong>Your area — only if you add it:</strong> the first half of your postcode (e.g.
            LS6), used to show local businesses and offers. Only you can see it.
          </li>
          <li>
            <strong>Business reviews and reports</strong> you write. Reviews are public; reports are
            only seen by RevMate's team.
          </li>
          <li>
            <strong>Buy &amp; Sell:</strong> if you add a postcode to an advert we keep only the
            first half (e.g. LS6) and its rough centre, to show buyers how far away it is. Offers
            you make or receive are only seen by you and the other person. Saved searches are
            private to you. If a seller marks you as the buyer, you can leave a public review of the
            seller. The postcode you use to search "near me" stays on your device.
          </li>
          <li>
            <strong>Consents:</strong> which version of our Terms and this policy you agreed to,
            when, and your marketing choice.
          </li>
          <li>
            <strong>Technical data:</strong> our hosting providers process your IP address, browser
            type and request logs to deliver the service and protect it from attacks. If you turn on
            phone notifications, we store your browser's push subscription.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Why we use it, and our lawful basis</h2>
        <ul>
          <li>
            <strong>To provide RevMate</strong> (your account, feed, garage, groups, meets,
            messages, Buy &amp; Sell and notifications) — <em>contract</em>.
          </li>
          <li>
            <strong>To keep people safe</strong>: age limits, moderation, handling reports,
            preventing spam, scams and abuse, and meeting our duties under the Online Safety Act
            2023 — <em>legal obligation</em> and <em>legitimate interests</em>.
          </li>
          <li>
            <strong>To personalise your feed</strong> ("For You" ranks posts using the makes you
            follow and what you engage with) and to improve RevMate — <em>legitimate interests</em>.
            You can always switch to another feed tab, such as Following, instead.
          </li>
          <li>
            <strong>Sponsored posts</strong>: we choose which ones to show you using your area (if
            you've added it) and the type of car in your garage (for example electric) —{" "}
            <em>legitimate interests</em>. Advertisers never receive your personal data; they only
            see how many people saw and tapped their ad.
          </li>
          <li>
            <strong>Marketing emails</strong> — only if you tick the box, and you can withdraw at
            any time in Settings — <em>consent</em>.
          </li>
          <li>
            <strong>Location and phone notifications</strong> — only when you turn them on —{" "}
            <em>consent</em>.
          </li>
        </ul>
        <p className="mt-2">
          We don't use your data for advertising profiles, we don't sell it, and we don't make
          decisions with legal or similarly significant effects about you by automated means.
        </p>
      </section>

      <section>
        <h2>4. What other people can see</h2>
        <p>
          Your username, profile photo, bio, garage, public posts, comments, reactions, follower
          counts and active listings are visible to other members, and some public pages (such as
          listings and link previews of shared posts) can be seen by people who aren't signed in and
          by search engines. Followers-only posts, private groups and messages are not public. Never
          put your phone number, address or bank details in a public post or listing.
        </p>
      </section>

      <section>
        <h2>5. Who we share it with</h2>
        <p>We use trusted providers who process data for us under contract:</p>
        <ul>
          <li>Supabase — database, sign-in, file storage and emails</li>
          <li>Cloudflare — hosting, content delivery and protection against attacks</li>
          <li>Lovable — the platform used to build and deploy the app</li>
          <li>
            Your browser's push service (e.g. Google, Apple or Mozilla) — only if you turn on phone
            notifications
          </li>
          <li>Google Maps — only when you tap to show a map on a meet</li>
        </ul>
        <p className="mt-2">
          Some providers may process data outside the UK. When they do, we rely on UK adequacy
          regulations or the UK International Data Transfer Agreement/Addendum to protect it. We may
          also share information with the police or regulators where the law requires it, or to
          protect someone from serious harm.
        </p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <p>
          We keep your information while your account is open. When you delete your account in
          Settings, your profile, garage, posts, comments, listings, messages you sent and other
          personal data are permanently deleted straight away. Copies may remain in encrypted
          backups for a short period before they're overwritten. We may keep a minimal record of
          serious safety breaches (such as a ban for illegal content) where we need it to protect
          others or meet a legal obligation.
        </p>
      </section>

      <section>
        <h2>7. Children and teenagers</h2>
        <p>
          You must be {MIN_AGE} or older to use RevMate. We ask for your date of birth when you join
          and refuse sign-ups from anyone younger. If we learn an account belongs to someone under{" "}
          {MIN_AGE}, we delete it. For members aged {MIN_AGE}–17 we apply extra protections: selling
          on Buy &amp; Sell, hosting meets and adding a location to posts unlock at{" "}
          {AGE_LIMITS.selling}, and direct messages unlock at {AGE_LIMITS.messages}. Adults can't
          start private conversations with members under {AGE_LIMITS.messages}.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>access your data and get a copy (Settings → Download my data)</li>
          <li>correct it (edit your profile, garage and posts at any time)</li>
          <li>delete it (Settings → Delete account)</li>
          <li>restrict or object to how we use it</li>
          <li>data portability (the download is in a machine-readable format)</li>
          <li>withdraw consent at any time (Settings → Privacy)</li>
        </ul>
        <p className="mt-2">
          To use any right, use Settings or contact us at {operatorValue(OPERATOR.contactEmail)}.
          We'll reply within one month. If you're unhappy with how we handle your data, you can
          complain to the Information Commissioner's Office at{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">
            ico.org.uk
          </a>{" "}
          or on 0303 123 1113.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          Data is encrypted in transit (HTTPS) and at rest. Access is controlled by row-level
          security, so members can only reach data they're allowed to see, and passwords are stored
          only as secure hashes. No system is perfect: use a unique password, and tell us straight
          away if you think your account has been compromised.
        </p>
      </section>

      <section>
        <h2>10. Cookies</h2>
        <p>
          RevMate doesn't use advertising or analytics cookies. See our{" "}
          <Link to="/legal/cookies">Cookie Policy</Link> for the small amount of storage we use to
          keep you signed in and remember your settings.
        </p>
      </section>

      <section>
        <h2>11. Changes</h2>
        <p>
          We'll update this page when things change and show the new date at the top. If a change is
          significant, we'll ask you to review it in the app.
        </p>
      </section>
    </LegalPage>
  );
}

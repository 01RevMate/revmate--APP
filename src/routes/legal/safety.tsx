import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { AGE_LIMITS, OPERATOR, operatorValue } from "@/lib/legal";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/safety")({
  head: () =>
    seo({
      title: "Safety & Reporting — RevMate",
      description:
        "How to stay safe buying and selling cars, going to meets and chatting on RevMate, how to report something, and how we handle complaints.",
      path: "/legal/safety",
    }),
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <LegalPage
      title="Safety & Reporting"
      updated="28 September 2026"
      intro={
        <p>
          If someone is in immediate danger, call <strong>999</strong>. To report a crime that isn't
          an emergency, call <strong>101</strong>. To report fraud, contact{" "}
          <a
            href="https://www.actionfraud.police.uk/"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            Action Fraud
          </a>
          .
        </p>
      }
    >
      <section>
        <h2>Buying and selling safely</h2>
        <ul>
          <li>
            See the car in person, in daylight, at the seller's home address shown on the V5C.
          </li>
          <li>Check the MOT history (free at gov.uk) and get an HPI or similar history check.</li>
          <li>
            Never pay a deposit or send money for a car you haven't seen. Be wary of prices that
            look too good.
          </li>
          <li>
            Keep chats on RevMate until you're confident — scammers often push to move to WhatsApp
            or email.
          </li>
          <li>
            Pay by bank transfer only once you're with the car and the paperwork, and never share
            one-time codes.
          </li>
          <li>Take someone with you, and tell a friend where you're going.</li>
        </ul>
      </section>

      <section>
        <h2>Meets</h2>
        <ul>
          <li>Only go to meets at venues where the organiser has permission.</li>
          <li>
            No dangerous driving, racing, burnouts or "car cruising" that breaks local rules or
            public space orders.
          </li>
          <li>
            Meet in public places and go with people you know. Under-18s should tell a parent or
            carer.
          </li>
        </ul>
      </section>

      <section>
        <h2>Protections for younger members</h2>
        <p>
          Members under 18 can't sell on Buy &amp; Sell, host meets or add their location to posts,
          and members under {AGE_LIMITS.messages} can't send or receive direct messages. If an adult
          is making you uncomfortable, block and report them. Childline is free and confidential:{" "}
          <strong>0800 1111</strong> or{" "}
          <a href="https://www.childline.org.uk/" target="_blank" rel="noreferrer">
            childline.org.uk
          </a>
          .
        </p>
      </section>

      <section>
        <h2>How to report something</h2>
        <ul>
          <li>Posts: use Report on the post.</li>
          <li>Listings and sellers: use "Report seller" on the listing.</li>
          <li>
            Members: open their profile and tap Block, so they can't see your posts or message you.
          </li>
          <li>In groups, moderators can also remove posts and ban members.</li>
          <li>
            Anything else, including comments and messages: email{" "}
            {operatorValue(OPERATOR.contactEmail)} with a link or screenshot.
          </li>
        </ul>
        <p className="mt-2">
          We review reports as quickly as we can and prioritise anything illegal or involving a risk
          to someone's safety, especially children. We remove illegal content, may suspend accounts,
          and report to the police where the law requires or someone is at risk.
        </p>
      </section>

      <section>
        <h2>Complaints and appeals</h2>
        <p>
          If you disagree with a moderation decision about your content or account, or you're
          unhappy with how we handled a report or our safety measures, email{" "}
          {operatorValue(OPERATOR.contactEmail)} with "Complaint" in the subject and details of what
          happened. We'll acknowledge it, review it fairly, and tell you the outcome. This is part
          of our duties under the Online Safety Act 2023.
        </p>
      </section>

      <section>
        <h2>More</h2>
        <p>
          Read our <Link to="/community-standards">Community Standards</Link>,{" "}
          <Link to="/legal/terms">Terms</Link> and <Link to="/legal/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}

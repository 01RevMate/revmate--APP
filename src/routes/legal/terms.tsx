import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { AGE_LIMITS, MIN_AGE, OPERATOR, operatorValue } from "@/lib/legal";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/terms")({
  head: () =>
    seo({
      title: "Terms of Service — RevMate",
      description:
        "The rules for using RevMate, including age requirements, content, Buy & Sell, meets, groups and how we handle reports.",
      path: "/legal/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="19 October 2026"
      intro={
        <p>
          These terms are the agreement between you and {operatorValue(OPERATOR.name)} ("RevMate",
          "we") for using the RevMate app and website. Please read them with our{" "}
          <Link to="/community-standards" className="font-medium underline">
            Community Standards
          </Link>{" "}
          and{" "}
          <Link to="/legal/privacy" className="font-medium underline">
            Privacy Policy
          </Link>
          . Nothing in these terms affects your statutory rights as a consumer.
        </p>
      }
    >
      <section>
        <h2>1. What RevMate is</h2>
        <p>
          RevMate is a UK car community: a place to share your cars, join groups and meets, get
          help, and buy and sell cars and parts with other members. RevMate is free to use.
        </p>
      </section>

      <section>
        <h2>2. Who can use RevMate</h2>
        <ul>
          <li>
            You must be at least {MIN_AGE} years old. Selling on Buy &amp; Sell, hosting meets and
            adding a location to posts are for people aged {AGE_LIMITS.selling}+, and direct
            messages are for people aged {AGE_LIMITS.messages}+.
          </li>
          <li>
            You must give your real date of birth. We delete accounts we believe belong to someone
            under {MIN_AGE}.
          </li>
          <li>One person per account. Keep your password safe and don't share your account.</li>
          <li>You can't use RevMate if we've banned you before.</li>
        </ul>
      </section>

      <section>
        <h2>3. Your content</h2>
        <p>
          You own what you post. By posting, you give RevMate a non-exclusive, royalty-free,
          worldwide licence to host, display, share and adapt it (for example, resizing photos and
          showing link previews) so we can run and promote the service. This licence ends when you
          delete the content or your account, except where it has been shared by others or we must
          keep it for legal reasons. Only post content you have the right to share, and don't post
          other people's number plates, faces or personal details in a way that could identify or
          harass them.
        </p>
      </section>

      <section>
        <h2>4. Rules</h2>
        <p>
          Follow the <Link to="/community-standards">Community Standards</Link>. In particular,
          don't post anything illegal, including content promoting dangerous or illegal driving,
          street racing on public roads, fraud, stolen goods, threats, harassment, hate, or sexual
          content. Don't spam, scrape the site, try to break its security or pretend to be someone
          else.
        </p>
      </section>

      <section>
        <h2>5. Buy &amp; Sell</h2>
        <ul>
          <li>
            RevMate is not a dealer, auctioneer or broker and isn't a party to any sale. Listings
            are written by members and aren't checked or guaranteed by us.
          </li>
          <li>
            Sellers must describe items honestly and accurately, own what they sell, and follow UK
            law — including consumer law if you sell as a trader (you must say so in your listing).
            Traders must also give buyers the information and rights required by the Consumer Rights
            Act 2015 and the Consumer Contracts Regulations 2013.
          </li>
          <li>
            Buyers should inspect a car in person, check its history (MOT history, HPI or similar
            check, V5C logbook) and never pay a deposit or transfer money before seeing it.
          </li>
          <li>
            Payment, collection and delivery happen directly between members. See our{" "}
            <Link to="/legal/safety">safety guide</Link>.
          </li>
          <li>
            Sponsored partner offers are always labelled "Sponsored". Your contract for those is
            with the partner, not RevMate.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Meets and groups</h2>
        <p>
          Meets are organised by members, not by RevMate. Organisers are responsible for having
          permission to use the venue and for running a safe, lawful event. Attendees take part at
          their own risk and must follow the law and the organiser's rules. Group owners and
          moderators can set entry rules, approve or remove members and remove posts in their group,
          but must still follow these terms.
        </p>
      </section>

      <section>
        <h2>7. Reporting, moderation and complaints</h2>
        <p>
          You can report any post, comment, listing, member or message. We review reports and may
          remove content, restrict features or suspend accounts that break these terms or the law,
          and we may report illegal content to the police. If we take action against your content or
          account, we'll tell you where we can and you can ask us to review the decision. You can
          also complain about how we handle reports or safety — see{" "}
          <Link to="/legal/safety">Safety &amp; reporting</Link>.
        </p>
      </section>

      <section>
        <h2>8. Ending your account</h2>
        <p>
          You can delete your account at any time in Settings → Delete account; this is immediate
          and permanent. We may suspend or close accounts that seriously or repeatedly break these
          terms.
        </p>
      </section>

      <section>
        <h2>9. Paid extras, deals and sponsors</h2>
        <p>
          Everything social on RevMate is free. Some optional extras cost money: featuring an
          advert, RevMate Plus and Business Pro. Prices are shown before you pay, include any VAT
          due, and payment is taken by Stripe.
        </p>
        <ul>
          <li>
            <strong>Featured adverts</strong> start as soon as you pay. Because you ask us to start
            straight away, you lose the 14-day right to cancel once the feature has begun. If your
            advert is removed for breaking these terms, the feature ends without a refund.
          </li>
          <li>
            <strong>RevMate Plus and Business Pro</strong> renew every month until you cancel. You
            can cancel any time in Settings → Plus &amp; billing; you keep the benefits until the
            end of the month you've paid for. You can also cancel within 14 days of first
            subscribing for a refund, less a fair amount for the days you've already used.
          </li>
          <li>
            If we change a price, it applies from your next renewal and we'll tell you first, so you
            can cancel before then.
          </li>
          <li>
            <strong>Deals</strong> are adverts for other companies and are labelled "Ad". We may
            earn a commission if you buy, at no extra cost to you. Your purchase is with that
            company, not RevMate.
          </li>
          <li>
            <strong>Shops</strong> are independent sellers. When you buy from one you buy on their
            website and the sale is between you and them. Shop owners must only list things they can
            legally sell, that are safe and, where it matters, road-legal.
          </li>
          <li>
            <strong>Fix a problem</strong> (including RevMate AI) gives a guide based on what you
            tell it, not a guaranteed diagnosis. It can't see or hear your car. Don't drive a car
            you think may be unsafe; ask a qualified mechanic.
          </li>
          <li>
            <strong>Promoted businesses and sponsored challenges</strong> are paid placements and
            are always labelled. Promotion doesn't mean we've checked or recommend a business.
          </li>
        </ul>
        <p>
          Nothing here affects your legal rights, for example if something you paid for doesn't work
          as described.
        </p>
      </section>

      <section>
        <h2>10. Our responsibility to you</h2>
        <p>
          We provide RevMate with reasonable care and skill, but we can't promise it will always be
          available or error-free. We aren't responsible for what members post or do, for
          transactions between members, or for losses we couldn't reasonably have foreseen. We don't
          exclude liability where it would be unlawful to do so, including for death or personal
          injury caused by our negligence, or for fraud.
        </p>
      </section>

      <section>
        <h2>11. Changes and contact</h2>
        <p>
          We may update these terms as RevMate grows. For significant changes we'll ask you to agree
          again in the app. These terms are governed by the laws of England and Wales, and you can
          bring a claim in the courts of the part of the UK where you live. Contact us at{" "}
          {operatorValue(OPERATOR.contactEmail)}.
        </p>
      </section>
    </LegalPage>
  );
}

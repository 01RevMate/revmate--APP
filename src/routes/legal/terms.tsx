import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — RevMate" },
      { name: "description", content: "RevMate's terms of service and marketplace disclaimer." },
      { property: "og:title", content: "Terms of Service — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated 24 September 2026</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">1. What RevMate is</h2>
          <p>
            RevMate is a platform that lets users share content about their cars and connect
            with other people who want to buy, sell, or discuss vehicles and parts. RevMate is
            not a dealer, auctioneer, broker, or party to any sale.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">2. Marketplace listings</h2>
          <p>
            Buy & Sell listings on RevMate are created entirely by users. RevMate does not
            inspect, verify, guarantee, or take ownership of any vehicle, part, or item listed.
            Any information shown on a listing — including price, mileage, condition, photos, or
            popularity/rank statistics — is supplied by the seller and has not been independently
            verified by RevMate. Buyers are responsible for inspecting a vehicle or item, checking
            its history (e.g. HPI/MOT checks), and satisfying themselves before agreeing to any
            purchase.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">3. No liability for transactions</h2>
          <p>
            RevMate is not currently involved in, and does not charge for, any transaction between
            buyers and sellers. All negotiation, payment, and exchange of goods happens directly
            between users, off-platform, at their own risk. To the fullest extent permitted by
            law, RevMate accepts no responsibility or liability for the accuracy of any listing,
            the conduct of any user, the condition or legality of any item sold, or any loss,
            damage, dispute, or fraud arising from a transaction connected through the platform.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">4. Your responsibilities</h2>
          <p>
            You agree to act honestly and lawfully when listing or buying on RevMate, not to
            misrepresent a vehicle or item, and to comply with all applicable UK consumer and
            trading laws that apply to your own sales (for example, as a private seller or, where
            applicable, as a trader).
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">5. Changes</h2>
          <p>
            As RevMate adds features (such as parts, mods, or paid transactions), these terms may
            be updated. Continued use of the app after an update means you accept the revised
            terms.
          </p>
        </section>

        <p className="text-xs">
          This is a general placeholder policy and does not constitute legal advice. It should be
          reviewed by a solicitor before RevMate charges for transactions or scales significantly.
        </p>
      </div>
    </div>
  );
}

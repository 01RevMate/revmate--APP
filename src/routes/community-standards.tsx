import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/community-standards")({ component: CommunityStandards });
const rules = [
  [
    "Respect people and their builds",
    "Beginners and experienced owners are equally welcome. No bullying, harassment, hate speech or personal attacks.",
  ],
  [
    "Keep discussions relevant",
    "Use All Cars for general automotive discussion. My Car and Same Brand use the car you post as. Group discussions stay inside the selected group and must follow its rules.",
  ],
  [
    "Your profile owns your garage",
    "You can speak as yourself or a current car in your garage. Choose your own car to contribute to the owner feeds. Inside groups, either identity is welcome.",
  ],
  [
    "Ask useful questions and share what worked",
    "Include the model, year, engine, symptoms and work already tried when asking for help. Explain the result when an issue is fixed so the next owner can learn from it.",
  ],
  [
    "Share genuine content",
    "Use content you have permission to share. Do not impersonate another member, claim someone else's car, misrepresent a vehicle or post misleading listings.",
  ],
  [
    "Protect privacy",
    "Do not publish another person's contact details, private conversations or identifying information without permission. Private-group discussions are intended for approved members.",
  ],
  [
    "Keep sales in Buy & Sell",
    "Use the marketplace for cars and parts. Be accurate about condition and your relationship to a seller or business. Repeated advertising, scams and unrelated adult promotions are not welcome.",
  ],
  [
    "Keep advice responsible",
    "Explain what you know and what you are unsure about. Do not encourage dangerous driving. Seek qualified help when a repair involves safety-critical systems.",
  ],
  [
    "Report problems",
    "Report inappropriate posts for the RevMate admins to review. Group moderators can approve or hide posts and manage members. Blocking a profile is managed through your account settings.",
  ],
  [
    "Moderation applies to everyone",
    "Posts may be held for approval or removed. Group access and account access can be restricted. Report counts flag issues for human review; they are not automatic proof of wrongdoing.",
  ],
];
function CommunityStandards() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Link to="/" className="text-sm text-primary">
        ← Back to RevMate
      </Link>
      <h1 className="text-2xl font-semibold">Community standards</h1>
      <p className="text-muted-foreground">
        A place to enjoy cars, learn from owners and help each other.
      </p>
      {rules.map(([title, body]) => (
        <section key={title} className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </section>
      ))}
    </main>
  );
}

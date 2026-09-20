import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { carLabel, carPath, type Car } from "@/lib/cars";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — RevMate" },
      {
        name: "description",
        content: "Your garage, your questions and your listings on RevMate.",
      },
      { property: "og:title", content: "Your profile — RevMate" },
      { property: "og:description", content: "Your garage, questions and listings on RevMate." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const garage = useQuery({
    queryKey: ["garage", user?.id],
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

  const myQuestions = useQuery({
    queryKey: ["my-questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*, cars(make, model, generation)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const myListings = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, cars(make, model, generation)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) {
    return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            Log in
          </Link>{" "}
          to see your garage, questions and listings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile.data?.username ?? user.email}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      <Section title="My garage">
        <ul className="space-y-2">
          {garage.data?.map((row) => {
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
          {garage.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">
              No saved cars yet.{" "}
              <Link to="/cars" className="underline">
                Browse cars
              </Link>
            </li>
          )}
        </ul>
      </Section>

      <Section title="My questions">
        <ul className="space-y-2">
          {myQuestions.data?.map((question) => (
            <li key={question.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{question.title}</p>
              {question.cars && (
                <p className="mt-1 text-xs text-muted-foreground">{carLabel(question.cars)}</p>
              )}
            </li>
          ))}
          {myQuestions.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No questions posted yet.</li>
          )}
        </ul>
      </Section>

      <Section title="My listings">
        <ul className="space-y-2">
          {myListings.data?.map((listing) => (
            <li key={listing.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{listing.title}</p>
                <span className="text-xs text-muted-foreground">
                  {listing.price != null ? `£${listing.price}` : "POA"} · {listing.type} ·{" "}
                  {listing.status}
                </span>
              </div>
              {listing.cars && (
                <p className="mt-1 text-xs text-muted-foreground">{carLabel(listing.cars)}</p>
              )}
            </li>
          ))}
          {myListings.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No listings yet.</li>
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

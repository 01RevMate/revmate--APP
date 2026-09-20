import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import { createPost } from "@/lib/posts";
import { fetchGarage } from "@/lib/garage";
import { CarPicker } from "@/components/CarPicker";

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const { data: profile } = useProfile();
  const [body, setBody] = useState("");
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [postingAs, setPostingAs] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (!user) {
      openAuthModal("Create a free account to post to the feed.");
      return;
    }
    setSaving(true);
    try {
      await createPost({
        userId: user.id,
        body: body.trim(),
        carId: carId || undefined,
        postedAsGarageCarId: postingAs || undefined,
      });
      setBody("");
      setCarId("");
      setTagging(false);
      onPosted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => !user && openAuthModal("Create a free account to post to the feed.")}
        placeholder="What are you working on?"
        rows={3}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {tagging && <CarPicker value={carId} onChange={setCarId} id="composer-car" />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (user ? setTagging((v) => !v) : openAuthModal("Create a free account to post to the feed."))}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {tagging ? "Remove car tag" : "+ Tag a car"}
          </button>
          {garage && garage.length > 0 && (
            <select
              value={postingAs}
              onChange={(e) => setPostingAs(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="">Posting as {profile?.username ?? "you"}</option>
              {garage.map((car) => (
                <option key={car.id} value={car.id}>
                  Posting as {car.nickname}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

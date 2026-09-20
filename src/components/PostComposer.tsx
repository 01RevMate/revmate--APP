import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import { createPost } from "@/lib/posts";
import { CarPicker } from "@/components/CarPicker";

export function PostComposer({ onPosted }: { onPosted: () => void }) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [body, setBody] = useState("");
  const [carId, setCarId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (!user) {
      openAuthModal("Create a free account to post to the feed.");
      return;
    }
    setSaving(true);
    try {
      await createPost({ userId: user.id, body: body.trim(), carId: carId || undefined });
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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (user ? setTagging((v) => !v) : openAuthModal("Create a free account to post to the feed."))}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {tagging ? "Remove car tag" : "+ Tag a car"}
        </button>
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

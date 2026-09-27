import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Camera, Flag, MessageSquare, Wrench } from "lucide-react";
import { fetchCarPhotos, fetchMods, MOD_CATEGORY_LABELS, type GarageCar } from "@/lib/garage";
import type { PostWithAuthor } from "@/lib/posts";
import { isVideoUrl } from "@/lib/social";

type TimelineEntry = {
  id: string;
  at: string;
  kind: "added" | "mod" | "photo" | "post";
  title: string;
  detail?: string | null;
  imageUrl?: string | null;
  postId?: string;
};

const ICONS = { added: Flag, mod: Wrench, photo: Camera, post: MessageSquare };

/**
 * A car's story in date order — when it joined RevMate, every mod, every
 * photo and every post made as the car — newest first.
 */
export function BuildTimeline({ car, posts }: { car: GarageCar; posts: PostWithAuthor[] }) {
  const { data: mods } = useQuery({
    queryKey: ["garage-mods", car.id],
    queryFn: () => fetchMods(car.id),
  });
  const { data: photos } = useQuery({
    queryKey: ["garage-car-photos", car.id],
    queryFn: () => fetchCarPhotos(car.id),
  });

  const entries = useMemo(() => {
    const list: TimelineEntry[] = [
      {
        id: `added-${car.id}`,
        at: car.created_at,
        kind: "added",
        title: `${car.nickname} joined the garage`,
        detail: [car.year, car.make, car.model].filter(Boolean).join(" "),
        imageUrl: car.photo_url,
      },
      ...(mods ?? []).map((mod) => ({
        id: `mod-${mod.id}`,
        at: mod.created_at,
        kind: "mod" as const,
        title: mod.title,
        detail: [mod.category ? MOD_CATEGORY_LABELS[mod.category] : null, mod.description]
          .filter(Boolean)
          .join(" · "),
      })),
      ...(photos ?? []).map((photo) => ({
        id: `photo-${photo.id}`,
        at: photo.created_at,
        kind: "photo" as const,
        title: "New photo",
        imageUrl: photo.photo_url,
      })),
      ...posts.map((post) => {
        const media = post.post_images.find((image) => !isVideoUrl(image.image_url));
        return {
          id: `post-${post.id}`,
          at: post.created_at,
          kind: "post" as const,
          title: post.body.length > 90 ? `${post.body.slice(0, 90)}…` : post.body || "Posted",
          imageUrl: media?.image_url ?? null,
          postId: post.id,
        };
      }),
    ];
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [car, mods, photos, posts]);

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {entries.map((entry) => {
        const Icon = ICONS[entry.kind];
        const body = (
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {format(new Date(entry.at), "d MMM yyyy")}
              </p>
              <p className="text-sm font-medium">{entry.title}</p>
              {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
            </div>
            {entry.imageUrl && (
              <img
                src={entry.imageUrl}
                alt=""
                className="size-14 shrink-0 rounded-md object-cover"
              />
            )}
          </div>
        );
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[37px] top-0.5 flex size-6 items-center justify-center rounded-full border border-border bg-background">
              <Icon className="size-3.5 text-primary" />
            </span>
            {entry.postId ? (
              <Link
                to="/posts/$postId"
                params={{ postId: entry.postId }}
                className="block rounded-md hover:bg-accent/40"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

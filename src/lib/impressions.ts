import { useCallback, useEffect, useRef } from "react";
import { looseDb } from "@/lib/looseDb";

// Which feed posts someone has actually seen (on screen for a second or
// more), so the For You feed (0069) can show something fresh next time
// instead of the same posts. Sent in small batches; members only.

const queue = new Set<string>();
let timer: number | null = null;

function flush() {
  timer = null;
  if (queue.size === 0) return;
  const ids = [...queue].slice(0, 50);
  ids.forEach((id) => queue.delete(id));
  // Supabase only sends the request once something waits on it. Before the
  // SQL runs this just fails quietly.
  void looseDb.rpc("record_post_impressions", { post_ids: ids }).then(() => undefined);
}

function enqueue(id: string) {
  queue.add(id);
  if (timer === null) timer = window.setTimeout(flush, 4000);
}

/**
 * Returns a ref callback for feed items: `ref={seenRef(post.id)}`. Does
 * nothing when `enabled` is false (signed out).
 */
export function useSeenTracker(enabled: boolean) {
  const observer = useRef<IntersectionObserver | null>(null);
  const timers = useRef(new Map<Element, number>());
  // Items can mount before the observer exists; remember them until it does.
  const waiting = useRef(new Set<HTMLElement>());

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const pending = timers.current;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset["postId"];
          if (!id) continue;
          if (entry.isIntersecting) {
            if (!pending.has(entry.target)) {
              pending.set(
                entry.target,
                window.setTimeout(() => {
                  enqueue(id);
                  observer.current?.unobserve(entry.target);
                }, 1000),
              );
            }
          } else {
            const t = pending.get(entry.target);
            if (t) window.clearTimeout(t);
            pending.delete(entry.target);
          }
        }
      },
      { threshold: 0.6 },
    );
    waiting.current.forEach((el) => observer.current?.observe(el));
    waiting.current.clear();
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [enabled]);

  return useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return;
      if (observer.current) observer.current.observe(el);
      else waiting.current.add(el);
    },
    [enabled],
  );
}

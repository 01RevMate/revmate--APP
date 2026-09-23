import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;
const MIN_REFRESH_MS = 2000;

// Facebook/Twitter-style pull-to-refresh: dragging down from the very top of
// the page reveals a spinner that grows with the pull, then spins
// continuously while `onRefresh` is in flight. Only engages when the page
// is already scrolled to the top, and uses native touch listeners (not
// React's synthetic ones) so preventDefault reliably stops the browser's
// own overscroll/bounce while dragging.
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]!.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0]!.clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      const resisted = delta < MAX_PULL ? delta : MAX_PULL + (delta - MAX_PULL) * 0.15;
      setPull(Math.min(resisted, MAX_PULL + 30));
      e.preventDefault();
    }

    function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      setPull((current) => {
        if (current >= THRESHOLD && !refreshingRef.current) {
          refreshingRef.current = true;
          setRefreshing(true);
          const refresh = Promise.resolve().then(onRefresh);
          const minimumDisplay = new Promise<void>((resolve) => {
            window.setTimeout(resolve, MIN_REFRESH_MS);
          });
          Promise.allSettled([refresh, minimumDisplay]).then(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPull(0);
          });
          return THRESHOLD;
        }
        return 0;
      });
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh]);

  const indicatorHeight = refreshing ? THRESHOLD : pull;

  return (
    <div ref={containerRef}>
      <div
        className="flex items-center justify-center gap-2 overflow-hidden text-muted-foreground transition-[height] duration-200 ease-out md:hidden"
        style={{ height: indicatorHeight }}
      >
        <Loader2
          className={`size-5 ${refreshing ? "animate-spin" : ""}`}
          style={
            refreshing
              ? undefined
              : {
                  transform: `rotate(${(pull / THRESHOLD) * 360}deg)`,
                  opacity: Math.min(pull / THRESHOLD, 1),
                }
          }
        />
        {refreshing && <span className="text-xs font-medium">Refreshing…</span>}
      </div>
      {children}
    </div>
  );
}

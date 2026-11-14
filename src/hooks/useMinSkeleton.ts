import { useEffect, useRef, useState } from "react";

/**
 * Keeps a skeleton on screen for at least `minMs` once loading has started, so
 * it doesn't flash away. Data that is already cached never shows a skeleton.
 * Call it before any early `return` in the component.
 */
export function useMinSkeleton(loading: boolean, minMs = 1000): boolean {
  const startedAt = useRef<number | null>(null);
  const [, tick] = useState(0);

  if (loading && startedAt.current === null) startedAt.current = Date.now();
  const elapsed = startedAt.current === null ? minMs : Date.now() - startedAt.current;
  const holding = !loading && startedAt.current !== null && elapsed < minMs;
  if (!loading && !holding) startedAt.current = null;

  useEffect(() => {
    if (!holding) return;
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(minMs - elapsed, 0));
    return () => clearTimeout(timer);
  }, [holding, minMs, elapsed]);

  return loading || holding;
}

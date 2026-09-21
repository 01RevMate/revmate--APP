import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type GliderRect = { left: number; top: number; width: number; height: number };

// A pill-shaped tab row where the active background is one element that
// slides to match the active tab, instead of every tab carrying its own
// background. Unlike a fixed-split slider (equal-width tabs, translateX by
// index), this measures each button's real layout box — needed here since
// labels vary in length and some tabs carry an icon.
export function SlidingTabBar({
  activeId,
  className = "",
  gliderClassName = "bg-primary",
  children,
}: {
  activeId: string;
  className?: string;
  gliderClassName?: string;
  children: (registerRef: (id: string) => (el: HTMLElement | null) => void) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const [rect, setRect] = useState<GliderRect | null>(null);

  function registerRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  function measure() {
    const el = itemRefs.current.get(activeId);
    setRect(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
  }

  useLayoutEffect(measure, [activeId]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={`relative flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {rect && (
        <span
          aria-hidden
          className={`absolute z-0 rounded-full transition-all duration-200 ease-out ${gliderClassName}`}
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}
      {children(registerRef)}
    </div>
  );
}

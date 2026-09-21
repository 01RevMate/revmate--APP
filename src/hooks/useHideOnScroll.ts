import { useEffect, useRef, useState } from "react";

// Scrolling down hides the bar, scrolling up brings it back — a small
// threshold avoids flicker from tiny scroll jitters (e.g. iOS rubber-band
// bounce), and it stays visible near the very top of the page.
export function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) > threshold) {
        setHidden(delta > 0 && y > 64);
        lastY.current = y;
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
}

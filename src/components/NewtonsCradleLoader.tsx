import type { CSSProperties } from "react";

export function NewtonsCradleLoader({ size = 50 }: { size?: number }) {
  return (
    <div
      className="newtons-cradle"
      style={{ "--uib-size": `${size}px` } as CSSProperties}
      role="status"
      aria-label="Loading"
    >
      <span className="newtons-cradle__dot" />
      <span className="newtons-cradle__dot" />
      <span className="newtons-cradle__dot" />
      <span className="newtons-cradle__dot" />
    </div>
  );
}

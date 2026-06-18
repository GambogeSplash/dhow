"use client";

import { useEffect, useRef, useState } from "react";

/** Demo mode speeds the count-up so the score moment lands faster on stage. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const DEFAULT_DURATION = DEMO_MODE ? 500 : 900;

/** Tweens from `from` to `value` once on mount and whenever `value` changes. */
export function AnimatedNumber({
  value,
  from,
  durationMs = DEFAULT_DURATION,
  className,
}: {
  value: number;
  from?: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(from ?? value);
  const startRef = useRef(from ?? value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = startRef.current;
    const delta = value - start;
    if (delta === 0) {
      setDisplay(value);
      return;
    }
    let t0: number | null = null;
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / durationMs);
      setDisplay(Math.round(start + delta * ease(p)));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else startRef.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      startRef.current = value;
    };
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}

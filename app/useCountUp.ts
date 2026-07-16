"use client";

// Bounded count-up: steps the displayed value for a fixed ~240ms after a change and stops.
// Not a persistent render loop, which is what docs/10's Performance section actually
// prohibits. Drops out under reduced motion, where the value simply snaps.
//
// The number this animates is often the amount you are about to charge someone, so the
// animation is never allowed to be the reason it is wrong. requestAnimationFrame does not
// fire in a hidden or backgrounded tab, which would strand the display on its starting
// value. So the target is guaranteed three ways: snap immediately if the page is hidden or
// motion is reduced, a guard timer that lands the value even if no frame ever runs, and a
// final settle on teardown. Motion is the garnish; the figure is the point.
//
// Shared by the invoice builder's running total and the dashboard's stat gauges.

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, ms = 240): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;

    if (reduce || document.hidden || from === target) {
      fromRef.current = target;
      setShown(target);
      return;
    }

    let raf: number | null = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      fromRef.current = target;
      setShown(target);
    };

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3); // ease-out: moves, then settles
      if (t < 1) {
        setShown(from + (target - from) * e);
        raf = requestAnimationFrame(tick);
      } else settle();
    };
    raf = requestAnimationFrame(tick);

    // Backstop. If no frame ever runs, this still lands the true value.
    const guard = window.setTimeout(settle, ms + 120);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.clearTimeout(guard);
      settle();
    };
  }, [target, ms]);

  return shown;
}

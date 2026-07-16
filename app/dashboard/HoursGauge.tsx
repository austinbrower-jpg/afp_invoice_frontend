"use client";

// The hours gauge, docs/10-visual-direction.md "Motion and character". A circular dial
// showing hours-this-month as a needle sweeping toward a monthly target, built with
// conic-gradient for the fill arc and transform: rotate() for the needle, both driven
// by one CSS custom property, --fill-percent, rather than JavaScript animating per
// frame. See app/globals.css for the @property registration that makes --fill-percent
// interpolate smoothly under `transition` instead of jumping.

import { useEffect, useState } from "react";

export function HoursGauge({
  hours,
  target,
}: {
  hours: number;
  target: number;
}) {
  const percent = Math.min(100, target > 0 ? (hours / target) * 100 : 0);

  // Rest state is 0, per docs/10: "a month with no hours logged yet still renders the
  // dial at rest... rather than an empty state or a hidden component." On mount, ease
  // from rest to the real value so the needle actually sweeps once, the same motion the
  // dial keeps for every later change. One rAF to sequence past the first paint, not a
  // per-frame loop: this fires once and stops.
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(percent);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div
      className="gauge"
      style={{ ["--fill-percent" as string]: shown }}
      role="img"
      aria-label={`${hours.toFixed(1)} of ${target} hours logged this month`}
    >
      <div className="gauge-needle" />
      <div className="gauge-face">
        <div className="gauge-value">
          {hours.toFixed(1)}
          <span className="gauge-unit">h</span>
        </div>
        <div className="gauge-target">of {target}h target</div>
      </div>
    </div>
  );
}

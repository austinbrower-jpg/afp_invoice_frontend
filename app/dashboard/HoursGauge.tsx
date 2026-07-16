"use client";

// The hours dial, docs/10 "Motion and character". A circular dial with a needle sweeping toward
// a target, built with conic-gradient and transform: rotate() driven by one CSS custom property.
// Generalized so the cockpit can point it at any metric: the caller resolves the center value,
// the arc fill percent, the unit, the foot text, and the aria label.

import { useEffect, useState } from "react";
import { money } from "@/lib/invoice";

export function HoursGauge({
  value,
  unit,
  fillPercent,
  foot,
  ariaLabel,
}: {
  value: number;
  unit: "h" | "$";
  fillPercent: number;
  foot: string;
  ariaLabel: string;
}) {
  const percent = Math.min(100, Math.max(0, fillPercent));
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
      aria-label={ariaLabel}
    >
      <div className="gauge-needle" />
      <div className="gauge-face">
        <div className="gauge-value">
          {unit === "$" ? (
            money(value)
          ) : (
            <>
              {value.toFixed(1)}
              <span className="gauge-unit">h</span>
            </>
          )}
        </div>
        <div className="gauge-target">{foot}</div>
      </div>
    </div>
  );
}

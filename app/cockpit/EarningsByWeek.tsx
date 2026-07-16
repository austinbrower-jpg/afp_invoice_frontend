// Earnings by week: one horizontal bar per week, length mapped to dollars against the biggest
// week in the set. Collected fills green (--ok), owed fills hot (--hot), so a paid week reads
// all green and money still out reads red. Current week is outlined amber. Pure CSS, no render
// loop. Tokens only, no hardcoded hex, per the two-systems rule. docs/10-visual-direction.md.

import type { WeekEarning } from "@/lib/hours";
import { money, shortDate } from "@/lib/invoice";

export default function EarningsByWeek({ weeks }: { weeks: WeekEarning[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.amount));
  const anyMoney = weeks.some((w) => w.amount > 0);

  return (
    <div className="earn">
      {!anyMoney ? (
        <p className="earn-empty">No earnings logged yet this period.</p>
      ) : (
        weeks.map((w) => {
          const collectedPct = (w.collected / max) * 100;
          const owedPct = (w.owed / max) * 100;
          return (
            <div className={`earn-row${w.isCurrent ? " current" : ""}`} key={w.weekStart}>
              <span className="earn-wk mono">{shortDate(w.weekStart)}</span>
              <span className="earn-track" aria-hidden="true">
                <span className="earn-fill ok" style={{ width: `${collectedPct}%` }} />
                <span className="earn-fill owed" style={{ width: `${owedPct}%` }} />
              </span>
              <span className="earn-hrs mono">{w.hours.toFixed(1)}h</span>
              <span className={`earn-amt mono${w.owed > 0 ? " owed" : " ok"}`}>
                {money(w.amount)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

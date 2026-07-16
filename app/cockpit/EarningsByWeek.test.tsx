import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EarningsByWeek from "./EarningsByWeek";
import type { WeekEarning } from "@/lib/hours";

const weeks: WeekEarning[] = [
  { weekStart: "2026-07-13", hours: 21.59, amount: 647.7, collected: 0, owed: 647.7, isCurrent: true },
  { weekStart: "2026-07-06", hours: 16.45, amount: 493.5, collected: 493.5, owed: 0, isCurrent: false },
];

describe("EarningsByWeek", () => {
  it("renders a row per week with the dollar figure", () => {
    const html = renderToStaticMarkup(<EarningsByWeek weeks={weeks} />);
    expect(html).toContain("$647.70");
    expect(html).toContain("$493.50");
  });

  it("marks the current week", () => {
    const html = renderToStaticMarkup(<EarningsByWeek weeks={weeks} />);
    expect(html).toContain("earn-row current");
  });

  it("renders an at-rest message when every week is empty", () => {
    const empty: WeekEarning[] = [
      { weekStart: "2026-07-13", hours: 0, amount: 0, collected: 0, owed: 0, isCurrent: true },
    ];
    const html = renderToStaticMarkup(<EarningsByWeek weeks={empty} />);
    expect(html).toContain("No earnings logged yet");
  });
});

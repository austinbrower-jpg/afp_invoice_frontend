import { describe, it, expect } from "vitest";
import { hhmm, to12h, sessionId, hoursBetween, elapsed } from "@/lib/clock";

describe("clock helpers", () => {
  it("hhmm zero-pads", () => {
    expect(hhmm(9, 3)).toBe("0903");
    expect(hhmm(14, 38)).toBe("1438");
  });
  it("to12h formats 12-hour with meridiem", () => {
    expect(to12h(9, 3)).toBe("9:03 AM");
    expect(to12h(14, 38)).toBe("2:38 PM");
    expect(to12h(0, 0)).toBe("12:00 AM");
    expect(to12h(12, 0)).toBe("12:00 PM");
  });
  it("sessionId matches the AFP-date-start-end format", () => {
    expect(sessionId("2026-07-16", 9, 3, 10, 27)).toBe("AFP-2026-07-16-0903-1027");
  });
  it("hoursBetween returns a raw float, correct across midnight", () => {
    expect(hoursBetween(0, 3_600_000)).toBeCloseTo(1, 10);
    const start = Date.UTC(2026, 6, 16, 23, 30);
    const end = Date.UTC(2026, 6, 17, 0, 30);
    expect(hoursBetween(start, end)).toBeCloseTo(1, 10);
  });
  it("elapsed formats H:MM:SS", () => {
    expect(elapsed(0)).toBe("0:00:00");
    expect(elapsed(5_025_000)).toBe("1:23:45");
  });
});

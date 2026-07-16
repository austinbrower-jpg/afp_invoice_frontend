import { describe, it, expect } from "vitest";
import { startOfWeekISO } from "@/lib/hours";

describe("startOfWeekISO", () => {
  it("anchors to the Monday of the week", () => {
    // 2026-07-15 is a Wednesday; its Monday is 2026-07-13.
    expect(startOfWeekISO("2026-07-15")).toBe("2026-07-13");
  });
});

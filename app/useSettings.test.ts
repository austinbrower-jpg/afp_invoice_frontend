import { describe, it, expect } from "vitest";
import { coerceSettings, DEFAULT_SETTINGS } from "@/app/useSettings";

describe("coerceSettings", () => {
  it("returns defaults for empty or non-object input", () => {
    expect(coerceSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and defaults invalid ones per field", () => {
    expect(coerceSettings({ theme: "overdrive", layout: "invoice", dialMetric: "today" }))
      .toEqual({ theme: "overdrive", layout: "invoice", dialMetric: "today" });
    expect(coerceSettings({ theme: "bogus", layout: "invoice", dialMetric: "week" }))
      .toEqual({ theme: "station", layout: "invoice", dialMetric: "week" });
    expect(coerceSettings({ theme: "ion" }))
      .toEqual({ theme: "ion", layout: "balanced", dialMetric: "month" });
    expect(coerceSettings({ theme: "ion", layout: "bogus", dialMetric: "today" }))
      .toEqual({ theme: "ion", layout: "balanced", dialMetric: "today" });
    expect(coerceSettings({ theme: "ion", layout: "invoice", dialMetric: "bogus" }))
      .toEqual({ theme: "ion", layout: "invoice", dialMetric: "month" });
  });
});

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClockControlView } from "@/app/cockpit/ClockControlView";

const base = {
  clockedIn: false,
  elapsedLabel: "0:00:00",
  startLabel: "",
  stale: false,
  saving: false,
  error: null as string | null,
  location: "Remote",
  locations: ["Remote", "Onsite / AFP"] as const,
  onLocation: () => {},
  onClockIn: () => {},
  onClockOut: () => {},
  onDiscard: () => {},
};

describe("ClockControlView", () => {
  it("shows Clock in when clocked out", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} />);
    expect(html).toContain("Clock in");
    expect(html).not.toContain("Clock out");
  });
  it("shows the elapsed time and Clock out when clocked in", () => {
    const html = renderToStaticMarkup(
      <ClockControlView {...base} clockedIn elapsedLabel="1:23:45" startLabel="9:03 AM" />
    );
    expect(html).toContain("1:23:45");
    expect(html).toContain("Clock out");
    expect(html).toContain("9:03 AM");
  });
  it("shows a discard affordance when the clock is stale", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} clockedIn stale />);
    expect(html).toContain("Discard");
  });
  it("shows an error message", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} clockedIn error="Save failed." />);
    expect(html).toContain("Save failed.");
  });
});

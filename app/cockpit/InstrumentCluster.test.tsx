import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InstrumentCluster from "./InstrumentCluster";

describe("InstrumentCluster", () => {
  it("renders four readout labels at rest when data is null", () => {
    const html = renderToStaticMarkup(<InstrumentCluster data={null} today={null} />);
    expect(html).toContain("Today");
    expect(html).toContain("This week");
    expect(html).toContain("This month");
    expect(html).toContain("Unbilled");
  });
});

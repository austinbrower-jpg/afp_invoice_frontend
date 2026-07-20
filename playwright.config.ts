import { defineConfig } from "@playwright/test";

// The print/PDF regression lives in e2e/ and is named *.pwtest.ts so it never collides with the
// vitest suite (which only matches *.test.ts). It is self-contained: each spec builds its own
// HTML fixture and renders through headless Chrome, so there is no dev server to start here.
//
// channel: "chrome" uses the system Google Chrome instead of a downloaded Chromium, so the test
// needs no `playwright install` step. page.pdf() (used by the geometry check) is Chromium-only,
// which Chrome satisfies.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pwtest.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    channel: "chrome",
    headless: true,
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Node environment: the pure logic needs no DOM, and presentational components are
// checked with react-dom/server's renderToStaticMarkup, which is also DOM-free. The
// alias mirrors the "@/..." paths tsconfig defines so tests import the same way the app does.
export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});

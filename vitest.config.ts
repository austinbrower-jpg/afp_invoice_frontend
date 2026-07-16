import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Node environment: the pure logic needs no DOM, and presentational components are
// checked with react-dom/server's renderToStaticMarkup, which is also DOM-free. The
// alias mirrors the "@/..." paths tsconfig defines so tests import the same way the app does.
// esbuild.jsx is forced to "automatic" here because tsconfig.json's "jsx": "preserve" is for
// Next's own SWC compiler; left at esbuild's default, vitest falls back to the classic
// transform and .tsx tests fail with "React is not defined" despite no code path needing it.
export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
});

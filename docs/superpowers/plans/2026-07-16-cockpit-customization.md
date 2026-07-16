# Cockpit Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add console customization to the AFP cockpit: 6 color themes, 3 layouts, and a configurable hours dial, chosen from a settings panel and persisted in localStorage.

**Architecture:** One `Settings` object (`{theme, layout, dialMetric}`) managed by a `useSettings` hook and persisted to localStorage. Theme and layout are applied as `data-theme` / `data-layout` attributes on the document root (set pre-paint by a tiny inline script to avoid a flash, and updated at runtime by the hook). Themes and layouts are pure CSS keyed on those attributes. The dial reads the chosen metric. The object is the seam a future widget board extends.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, hand-written CSS. Tests run on Vitest (Node environment); the pure settings-validation logic is unit-tested, UI is verified by build and visual check.

## Global Constraints

- No em dashes in code, comments, docs, or commit messages.
- No hardcoded hex in components; colors come from the CSS custom properties. The theme CSS blocks in globals.css are the one place hex values live.
- The console (`.station` tokens) and the paper (`.paper` tokens) stay separate design systems. No theme touches the paper tokens; the paper always prints as the verified artifact.
- Notion and billing data never touch localStorage. The only thing stored is `{theme, layout, dialMetric}` under the key `afp.cockpit.settings.v1`.
- Reduced motion is already enforced globally at the bottom of globals.css; do not remove it.
- Keyboard focus stays visible (the settings panel is keyboard accessible).
- The `@media print` block must keep rendering only the paper under every theme and layout.

## Shared interfaces defined by this plan

- `app/useSettings.ts` (Task 1): `ThemeName`, `LayoutName`, `DialMetric`, `Settings`, `DEFAULT_SETTINGS`, `SETTINGS_KEY`, `coerceSettings(raw): Settings`, and `useSettings()` returning `{ settings, setTheme, setLayout, setDialMetric }`.
- `app/dashboard/HoursGauge.tsx` (Task 4): generalized props `{ value: number; unit: "h" | "$"; fillPercent: number; foot: string; ariaLabel: string }`.
- `app/cockpit/SettingsPanel.tsx` (Task 5): props `{ settings, setTheme, setLayout, setDialMetric }`.
- `app/cockpit/InvoiceSummary.tsx` (Task 7): props `{ sessions: number; amount: number; onBuild: () => void }`.

---

## Task 1: useSettings hook and validation

**Files:**
- Create: `app/useSettings.ts`
- Create: `app/useSettings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the settings types, `DEFAULT_SETTINGS`, `SETTINGS_KEY`, `coerceSettings`, `useSettings`.

- [ ] **Step 1: Write failing tests for coerceSettings**

Create `app/useSettings.test.ts`:

```ts
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
  });
});
```

Note: the import path is `@/app/useSettings` because the file lives under `app/`. Confirm the vitest `@` alias resolves it (it maps `@` to the repo root, so `@/app/useSettings` is correct).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test app/useSettings.test.ts`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Implement the hook**

Create `app/useSettings.ts`:

```ts
"use client";

// One settings object for console customization, persisted to localStorage. This is the seam a
// future widget board grows from: it would extend Settings with a panels array and bump the key
// version. Theme and layout are applied as data-theme / data-layout on the document root (the
// inline script in app/layout.tsx sets them pre-paint; this hook updates them on change).
// Only UI preferences are stored here, never Notion or billing data. See
// docs/superpowers/specs/2026-07-16-cockpit-customization-design.md and docs/06-ui-spec.md.

import { useCallback, useEffect, useState } from "react";

export type ThemeName = "station" | "ion" | "ember" | "daylight" | "overdrive" | "mono";
export type LayoutName = "balanced" | "invoice" | "instruments";
export type DialMetric = "today" | "week" | "month" | "unbilled";
export type Settings = { theme: ThemeName; layout: LayoutName; dialMetric: DialMetric };

const THEMES: ThemeName[] = ["station", "ion", "ember", "daylight", "overdrive", "mono"];
const LAYOUTS: LayoutName[] = ["balanced", "invoice", "instruments"];
const METRICS: DialMetric[] = ["today", "week", "month", "unbilled"];

export const DEFAULT_SETTINGS: Settings = { theme: "station", layout: "balanced", dialMetric: "month" };
export const SETTINGS_KEY = "afp.cockpit.settings.v1";

// Validate parsed storage into a clean Settings, falling back per field. Never throws.
export function coerceSettings(raw: unknown): Settings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    theme: THEMES.includes(r.theme as ThemeName) ? (r.theme as ThemeName) : DEFAULT_SETTINGS.theme,
    layout: LAYOUTS.includes(r.layout as LayoutName) ? (r.layout as LayoutName) : DEFAULT_SETTINGS.layout,
    dialMetric: METRICS.includes(r.dialMetric as DialMetric)
      ? (r.dialMetric as DialMetric)
      : DEFAULT_SETTINGS.dialMetric,
  };
}

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? coerceSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function apply(s: Settings) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.layout = s.layout;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // localStorage is client-only, so sync after mount. The inline script already applied
  // theme/layout pre-paint, so this does not flash; it aligns React state (which drives the
  // dial metric) to what is stored.
  useEffect(() => {
    setSettings(read());
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // ignore write failures (private mode, quota); the session still reflects the change
      }
      apply(next);
      return next;
    });
  }, []);

  return {
    settings,
    setTheme: (theme: ThemeName) => update({ theme }),
    setLayout: (layout: LayoutName) => update({ layout }),
    setDialMetric: (dialMetric: DialMetric) => update({ dialMetric }),
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test app/useSettings.test.ts && npm run typecheck`
Expected: 2 tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/useSettings.ts app/useSettings.test.ts
git commit -m "Add useSettings hook and settings validation"
```

---

## Task 2: No-flash inline script

**Files:**
- Modify: `app/layout.tsx` (add a pre-paint script in `<head>`)

**Interfaces:**
- Consumes: the `SETTINGS_KEY` value and the theme/layout name lists (inlined as literals, since this is a raw script string, not a module import).
- Produces: `data-theme` and `data-layout` on `<html>` before paint.

- [ ] **Step 1: Add the script**

In `app/layout.tsx`, inside `<head>`, after the font `<link>` tags and before `</head>`, add:

```tsx
        {/* Applies the saved theme and layout before paint so there is no flash of the default.
            Runs before React hydrates; React does not manage these attributes, so no mismatch.
            Fails safe to the defaults. Kept in sync with app/useSettings.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=JSON.parse(localStorage.getItem('afp.cockpit.settings.v1')||'{}');" +
              "var t=['station','ion','ember','daylight','overdrive','mono'];" +
              "var l=['balanced','invoice','instruments'];" +
              "document.documentElement.dataset.theme=t.indexOf(s.theme)>=0?s.theme:'station';" +
              "document.documentElement.dataset.layout=l.indexOf(s.layout)>=0?s.layout:'balanced';" +
              "}catch(e){document.documentElement.dataset.theme='station';document.documentElement.dataset.layout='balanced';}",
          }}
        />
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles. (The script is inert until themes exist; it just sets attributes.)

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "Apply saved theme and layout pre-paint to avoid a flash"
```

---

## Task 3: Theme CSS

**Files:**
- Modify: `app/globals.css` (add theme token blocks and Overdrive glow)

**Interfaces:**
- Consumes: `data-theme` on the root (from Task 2 and the hook).
- Produces: the five non-default theme token overrides plus Overdrive glow. Station stays the base default (the existing `.station { --bg... }` block), so no `data-theme="station"` block is needed.

- [ ] **Step 1: Add the theme blocks**

Append to `app/globals.css`, before the final `@media (prefers-reduced-motion: reduce)` block:

```css
/* ---------- themes ----------
   Each theme overrides the console token values keyed on the root data-theme attribute. The
   semantic names stay: --amber is worked, --hot is money owed, --ok is settled. So e.g. Ion sets
   --amber to a cyan on purpose (renaming every token across all components is out of scope). No
   theme touches the paper tokens; the paper is a separate system. Station is the base default in
   the .station rule above, so it needs no block here. See the customization spec. */

:root[data-theme="ion"] .station {
  --bg: #080b12; --panel: #0f1620; --line: #1c2a38; --line-2: #2a3d50;
  --tx: #c6d6e6; --dim: #5e7180; --dim-2: #3e4c58;
  --amber: #38bdf8; --hot: #fb7185; --ok: #34d399;
}
:root[data-theme="ember"] .station {
  --bg: #0e0a08; --panel: #1a1310; --line: #33241c; --line-2: #4a362a;
  --tx: #e6d5c6; --dim: #8a7160; --dim-2: #5c4b3e;
  --amber: #fbbf24; --hot: #e11d48; --ok: #2dd4bf;
}
:root[data-theme="daylight"] .station {
  --bg: #f4f5f7; --panel: #ffffff; --line: #d8dce2; --line-2: #c2c8d0;
  --tx: #1a1f26; --dim: #6b7480; --dim-2: #9aa1ab;
  --amber: #b45309; --hot: #dc2626; --ok: #059669;
}
:root[data-theme="overdrive"] .station {
  --bg: #070510; --panel: #130a26; --line: #2e1a50; --line-2: #452870;
  --tx: #ece4ff; --dim: #8778b0; --dim-2: #5e5488;
  --amber: #ff2e97; --hot: #ff3b57; --ok: #2ef2ff;
}
:root[data-theme="mono"] .station {
  --bg: #0c0d0e; --panel: #141516; --line: #26282a; --line-2: #3a3d40;
  --tx: #d4d6d8; --dim: #6a6e72; --dim-2: #4a4d50;
  --amber: #b8bcc0; --hot: #c79a5a; --ok: #7e8286;
}

/* Overdrive: the badass one. Static CSS glow on the money and the worked figures, plus the
   signal dots and fills. Static shadows (no animation), so they survive reduced motion. */
:root[data-theme="overdrive"] .g.cash .v,
:root[data-theme="overdrive"] .runner .row.total b {
  text-shadow: 0 0 16px color-mix(in srgb, var(--hot) 75%, transparent);
}
:root[data-theme="overdrive"] .g.pri .v {
  text-shadow: 0 0 14px color-mix(in srgb, var(--amber) 65%, transparent);
}
:root[data-theme="overdrive"] .led-ready,
:root[data-theme="overdrive"] .led-paid {
  box-shadow: 0 0 8px color-mix(in srgb, var(--ok) 70%, transparent);
}
:root[data-theme="overdrive"] .earn-fill.owed {
  box-shadow: 0 0 10px color-mix(in srgb, var(--hot) 60%, transparent);
}
```

- [ ] **Step 2: Verify build and a quick manual theme check**

Run: `npm run build`
Expected: compiles. To eyeball a theme without wiring the panel yet, the reviewer may set `document.documentElement.dataset.theme = 'overdrive'` in devtools on a running dev server and confirm the console recolors and the paper does not. This is optional at this step; the settings panel in Task 5 exercises it for real.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add the five theme token blocks and Overdrive glow"
```

---

## Task 4: Generalize the dial and wire the metric

**Files:**
- Modify: `app/dashboard/HoursGauge.tsx` (generalize props)
- Modify: `app/page.tsx` (introduce useSettings, compute the dial view from the metric)

**Interfaces:**
- Consumes: `useSettings` (Task 1); `dayReadout`, `weekReadout`, `monthReadout`, `unbilled` from `@/lib/hours`; `money` from `@/lib/invoice`.
- Produces: the generalized `HoursGauge`.

- [ ] **Step 1: Generalize HoursGauge**

Replace the body of `app/dashboard/HoursGauge.tsx` with:

```tsx
"use client";

// The hours dial, docs/10 "Motion and character". A circular dial with a needle sweeping toward
// a target, built with conic-gradient and transform: rotate() driven by one CSS custom property.
// Generalized so the cockpit can point it at any metric: the caller resolves the center value,
// the arc fill percent, the unit, the foot text, and the aria label.

import { useEffect, useState } from "react";
import { money } from "@/lib/invoice";

export function HoursGauge({
  value,
  unit,
  fillPercent,
  foot,
  ariaLabel,
}: {
  value: number;
  unit: "h" | "$";
  fillPercent: number;
  foot: string;
  ariaLabel: string;
}) {
  const percent = Math.min(100, Math.max(0, fillPercent));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(percent);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div
      className="gauge"
      style={{ ["--fill-percent" as string]: shown }}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="gauge-needle" />
      <div className="gauge-face">
        <div className="gauge-value">
          {unit === "$" ? (
            money(value)
          ) : (
            <>
              {value.toFixed(1)}
              <span className="gauge-unit">h</span>
            </>
          )}
        </div>
        <div className="gauge-target">{foot}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire useSettings and the dial view in page.tsx**

In `app/page.tsx`:

- Add imports: `import { useSettings } from "./useSettings";` and add `dayReadout`, `weekReadout`, `monthReadout`, `unbilled` to the existing `@/lib/hours` import (which currently imports `weeklyEarnings`). Keep `monthReadout` if it is already imported from the dial work; do not import it twice.
- Near the other hooks, add: `const { settings, setTheme, setLayout, setDialMetric } = useSettings();`
- Replace the existing `monthHours` constant and the dial-card block with a metric-driven view. Add this memo (after `today2` is defined):

```tsx
const dial = useMemo(() => {
  const rest = { value: 0, unit: "h" as const, fillPercent: 0, foot: "of 60 h target", label: "Hours this month", ariaLabel: "dial at rest" };
  if (!data || !today2) return rest;
  const m = settings.dialMetric;
  if (m === "today") {
    const h = dayReadout(data.hours, today2).hours;
    return { value: h, unit: "h" as const, fillPercent: (h / 8) * 100, foot: "of 8 h day", label: "Hours today", ariaLabel: `${h.toFixed(1)} of 8 hours today` };
  }
  if (m === "week") {
    const h = weekReadout(data.hours, today2).hours;
    return { value: h, unit: "h" as const, fillPercent: (h / 40) * 100, foot: "of 40 h week", label: "Hours this week", ariaLabel: `${h.toFixed(1)} of 40 hours this week` };
  }
  if (m === "unbilled") {
    const u = unbilled(data, today2);
    return { value: u.amount, unit: "$" as const, fillPercent: (u.hours / 60) * 100, foot: `${u.sessions} session${u.sessions === 1 ? "" : "s"} owed`, label: "Unbilled", ariaLabel: `${money(u.amount)} unbilled` };
  }
  const h = monthReadout(data.hours, today2).hours;
  return { value: h, unit: "h" as const, fillPercent: (h / 60) * 100, foot: "of 60 h target", label: "Hours this month", ariaLabel: `${h.toFixed(1)} of 60 hours this month` };
}, [settings.dialMetric, data, today2]);
```

- Replace the dial-card JSX with:

```tsx
<div className="dial-card">
  <h2 className="eyebrow">{dial.label}</h2>
  <HoursGauge
    value={dial.value}
    unit={dial.unit}
    fillPercent={dial.fillPercent}
    foot={dial.foot}
    ariaLabel={dial.ariaLabel}
  />
</div>
```

Note: the previous dial-card also had a `.dial-foot` line duplicating the target; the gauge now shows the foot text internally, so the separate `.dial-foot` line is removed. Confirm `MONTHLY_TARGET_HOURS` is still imported only if still used elsewhere in page.tsx; if this change leaves it unused, remove that import.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/HoursGauge.tsx app/page.tsx
git commit -m "Generalize the dial and drive it from the settings metric"
```

---

## Task 5: Settings panel

**Files:**
- Create: `app/cockpit/SettingsPanel.tsx`
- Modify: `app/page.tsx` (render the panel in the topbar)
- Modify: `app/globals.css` (settings panel styles)

**Interfaces:**
- Consumes: the settings types and setters from `useSettings`.
- Produces: `SettingsPanel` with props `{ settings, setTheme, setLayout, setDialMetric }`.

- [ ] **Step 1: Create the panel**

Create `app/cockpit/SettingsPanel.tsx`:

```tsx
"use client";

// The settings panel: a gear button in the topbar that opens a popover to pick theme, layout, and
// the dial metric. Applies live via the useSettings setters. Keyboard accessible: focus is
// visible (the console focus ring applies), Escape closes.

import { useEffect, useRef, useState } from "react";
import type { Settings, ThemeName, LayoutName, DialMetric } from "../useSettings";

const THEMES: { id: ThemeName; label: string }[] = [
  { id: "station", label: "Station" },
  { id: "ion", label: "Ion" },
  { id: "ember", label: "Ember" },
  { id: "daylight", label: "Daylight" },
  { id: "overdrive", label: "Overdrive" },
  { id: "mono", label: "Mono" },
];
const LAYOUTS: { id: LayoutName; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "invoice", label: "Invoice focus" },
  { id: "instruments", label: "Instruments focus" },
];
const METRICS: { id: DialMetric; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "unbilled", label: "Unbilled" },
];

export function SettingsPanel({
  settings,
  setTheme,
  setLayout,
  setDialMetric,
}: {
  settings: Settings;
  setTheme: (t: ThemeName) => void;
  setLayout: (l: LayoutName) => void;
  setDialMetric: (m: DialMetric) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        className="gear"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Simple gear glyph, no icon dependency */}
        <span aria-hidden="true">&#9881;</span>
      </button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Console settings">
          <div className="set-group">
            <span className="eyebrow">Theme</span>
            <div className="set-swatches">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`swatch sw-${t.id}${settings.theme === t.id ? " on" : ""}`}
                  aria-pressed={settings.theme === t.id}
                  title={t.label}
                  onClick={() => setTheme(t.id)}
                />
              ))}
            </div>
          </div>
          <div className="set-group">
            <span className="eyebrow">Layout</span>
            <div className="set-rows">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  className={`set-row${settings.layout === l.id ? " on" : ""}`}
                  aria-pressed={settings.layout === l.id}
                  onClick={() => setLayout(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="set-group">
            <label className="eyebrow" htmlFor="dial-metric">Dial shows</label>
            <select
              id="dial-metric"
              value={settings.dialMetric}
              onChange={(e) => setDialMetric(e.target.value as DialMetric)}
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the panel styles**

Append to `app/globals.css`, before the final reduced-motion block:

```css
/* ---------- settings panel ---------- */
.settings { position: relative; }
.gear {
  display: grid; place-items: center; width: 34px; height: 34px;
  border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
  color: var(--dim); cursor: pointer; font-size: 16px;
  transition: color 120ms ease, border-color 120ms ease;
}
.gear:hover { color: var(--tx); border-color: var(--amber); }
.settings-pop {
  position: absolute; top: 42px; right: 0; z-index: 40; width: 260px;
  background: var(--panel); border: 1px solid var(--line-2); border-radius: 10px;
  padding: 14px; display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5);
}
.set-group { display: flex; flex-direction: column; gap: 8px; }
.set-swatches { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.swatch {
  aspect-ratio: 1; border-radius: 6px; border: 1px solid var(--line); cursor: pointer;
  transition: transform 120ms ease;
}
.swatch:hover { transform: scale(1.1); }
.swatch.on { outline: 2px solid var(--amber); outline-offset: 1px; }
.sw-station { background: #0a0c10; box-shadow: inset 0 -6px 0 #f0a93b; }
.sw-ion { background: #080b12; box-shadow: inset 0 -6px 0 #38bdf8; }
.sw-ember { background: #0e0a08; box-shadow: inset 0 -6px 0 #fbbf24; }
.sw-daylight { background: #f4f5f7; box-shadow: inset 0 -6px 0 #b45309; }
.sw-overdrive { background: #070510; box-shadow: inset 0 -6px 0 #ff2e97; }
.sw-mono { background: #0c0d0e; box-shadow: inset 0 -6px 0 #b8bcc0; }
.set-rows { display: flex; flex-direction: column; gap: 4px; }
.set-row {
  text-align: left; padding: 7px 10px; border-radius: 6px; cursor: pointer;
  background: transparent; border: 1px solid var(--line); color: var(--dim);
  font-family: var(--ui); font-size: 12px;
  transition: color 120ms ease, border-color 120ms ease;
}
.set-row:hover { color: var(--tx); }
.set-row.on { color: var(--tx); border-color: var(--amber); }
```

Note: the swatch preview colors are literal hex on purpose. They are a fixed catalog of the themes, not themable console surfaces, so they are exempt from the no-hardcoded-hex rule the same way the theme blocks are.

- [ ] **Step 3: Render the panel in the topbar**

In `app/page.tsx`, import `import { SettingsPanel } from "./cockpit/SettingsPanel";`. In the topbar JSX, add the panel just before the `Save PDF` button:

```tsx
<SettingsPanel
  settings={settings}
  setTheme={setTheme}
  setLayout={setLayout}
  setDialMetric={setDialMetric}
/>
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/cockpit/SettingsPanel.tsx app/page.tsx app/globals.css
git commit -m "Add the settings panel with theme, layout, and dial controls"
```

---

## Task 6: Layout CSS

**Files:**
- Modify: `app/globals.css` (Invoice focus and Instruments focus rules keyed on data-layout)

**Interfaces:**
- Consumes: `data-layout` on the root; the existing cockpit class names (`.cockpit-top`, `.cockpit-split`, `.cockpit-console`, `.gauges`, `.mod`, `.dial-card`, `.paperstage`, the day-trace `.mod` and the `.earn` block).
- Produces: the two non-default layouts. Balanced is the base (no rules).

- [ ] **Step 1: Add the layout rules**

Append to `app/globals.css`, before the final reduced-motion block:

```css
/* ---------- layouts ----------
   Balanced is the base cockpit. The other two re-weight instruments vs paper, keyed on the root
   data-layout attribute. Pure CSS. The paper never changes shape (it is a print artifact); in
   Instruments focus the full paper is hidden on screen and a compact summary shows instead, but
   the paper stays in the DOM so print is unaffected. */

/* Invoice focus: slim the instruments, widen the paper. */
:root[data-layout="invoice"] .cockpit-top .mod { display: none; }            /* hide the day trace */
:root[data-layout="invoice"] .cockpit-top .gauges { grid-template-columns: repeat(4, 1fr); }
:root[data-layout="invoice"] .cockpit-top .g { padding: 8px 12px; }
:root[data-layout="invoice"] .cockpit-top .g .v { font-size: 20px; margin-top: 4px; }
:root[data-layout="invoice"] .cockpit-top .g .u { display: none; }
:root[data-layout="invoice"] .cockpit-console .dial-card,
:root[data-layout="invoice"] .cockpit-console .earn,
:root[data-layout="invoice"] .cockpit-console h2:first-of-type { display: none; }
:root[data-layout="invoice"] .cockpit-split { grid-template-columns: 300px 1fr; }

/* Instruments focus: enlarge the trace and dial, hide the full paper, show the summary card. */
:root[data-layout="instruments"] .cockpit-top .mod-b { padding-bottom: 22px; }
:root[data-layout="instruments"] .cockpit-split { grid-template-columns: 380px 1fr; }
:root[data-layout="instruments"] .paperstage .paper { display: none; }
:root[data-layout="instruments"] .invoice-summary { display: flex; }
/* the summary card is display:none by default (Task 7), shown only here */
```

Note on the `h2:first-of-type` hide in Invoice focus: the first console `h2` is "Sessions in range" only after the dial-card (which has its own `h2.eyebrow`). Confirm against the rendered DOM which `h2` is first; if hiding the wrong heading, target the earnings heading specifically by pairing it with the `.earn` block instead. The reviewer should verify this visually. If ambiguous, prefer wrapping the earnings block and its heading in a container and toggling that, rather than nth-of-type guessing.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles. Visual verification happens in Task 7 once the summary card exists.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add the Invoice focus and Instruments focus layouts"
```

---

## Task 7: Compact invoice summary card

**Files:**
- Create: `app/cockpit/InvoiceSummary.tsx`
- Modify: `app/page.tsx` (render the summary in the paper column; wire Build invoice)
- Modify: `app/globals.css` (summary card styles, hidden by default)

**Interfaces:**
- Consumes: `money` from `@/lib/invoice`.
- Produces: `InvoiceSummary` with props `{ sessions: number; amount: number; onBuild: () => void }`.

- [ ] **Step 1: Create the component**

Create `app/cockpit/InvoiceSummary.tsx`:

```tsx
// The compact invoice card shown only in the Instruments focus layout (CSS toggles it). It sits
// beside the full paper, which stays in the DOM and hidden on screen so print is unaffected.
// "Build invoice" switches back to a paper-forward layout.

import { money } from "@/lib/invoice";

export function InvoiceSummary({
  sessions,
  amount,
  onBuild,
}: {
  sessions: number;
  amount: number;
  onBuild: () => void;
}) {
  return (
    <div className="invoice-summary">
      <div className="eyebrow">Selected to bill</div>
      <div className="isum-amt mono">{money(amount)}</div>
      <div className="isum-sub mono">
        {sessions} session{sessions === 1 ? "" : "s"}
      </div>
      <button className="print-btn" onClick={onBuild}>Build invoice</button>
    </div>
  );
}
```

- [ ] **Step 2: Add the styles (hidden by default)**

Append to `app/globals.css`, before the final reduced-motion block:

```css
/* Compact invoice summary: hidden by default, shown only under Instruments focus (Task 6). */
.invoice-summary {
  display: none;
  flex-direction: column;
  gap: 10px;
  align-self: start;
  margin: 0 auto;
  padding: 22px 26px;
  background: var(--panel);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  min-width: 260px;
}
.isum-amt { font-size: 30px; color: var(--hot); line-height: 1; }
.isum-sub { font-size: 12px; color: var(--dim); }
```

- [ ] **Step 3: Render it in page.tsx**

In `app/page.tsx`, import `import { InvoiceSummary } from "./cockpit/InvoiceSummary";`. In the `<main className="paperstage">`, render the summary alongside `InvoicePaper` (both always in the DOM; CSS shows one per layout):

```tsx
<main className="paperstage">
  <InvoiceSummary
    sessions={selected.length}
    amount={runnerAmt}
    onBuild={() => setLayout("invoice")}
  />
  <InvoicePaper
    data={data} err={err} lines={lines} entries={entries}
    invno={invno} invdate={invdate} duedate={duedate} terms={terms}
    totalHours={totalHours} totalAmt={totalAmt} rates={rates} showsid={showsid}
  />
</main>
```

Note: `runnerAmt` already exists in page.tsx (the un-rounded selected amount). Use it for the summary so the card matches the running total.

- [ ] **Step 4: Add the summary card to the print-hide list**

In the `@media print` block of `app/globals.css`, add `.invoice-summary` to the `display: none !important;` group so the compact card never prints (only the paper prints). The group currently lists `.topbar, .rail, .printwipe, .deck, .cockpit-top, .cockpit-console`; add `.invoice-summary`.

- [ ] **Step 5: Typecheck, build, and visual check**

Run: `npm run typecheck && npm run build`
Expected: clean. Then, on a running dev server (or the deployed preview), switch to each layout via the settings panel and confirm: Balanced unchanged; Invoice focus slims the instruments and widens the paper; Instruments focus enlarges the trace, hides the full paper, and shows the summary card, and "Build invoice" flips to Invoice focus. Confirm Cmd+P still prints only the paper under every layout and theme.

- [ ] **Step 6: Commit**

```bash
git add app/cockpit/InvoiceSummary.tsx app/page.tsx app/globals.css
git commit -m "Add the compact invoice summary for Instruments focus"
```

---

## Task 8: Document the rule change and final verification

**Files:**
- Modify: `docs/06-ui-spec.md` (amend the browser-storage note)

- [ ] **Step 1: Amend the quality floor note**

In `docs/06-ui-spec.md`, find the "No browser storage of any kind." line in the Quality floor section and replace it with:

```
No browser storage of Notion or billing data. UI preferences (theme, layout, dial metric) may
be stored in localStorage under a single key, per
docs/superpowers/specs/2026-07-16-cockpit-customization-design.md.
```

- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all tests pass, build compiles all pages.

- [ ] **Step 3: Persistence check**

On a running dev server or the deployed preview: change theme, layout, and dial metric; reload the page; confirm all three survive the reload (read back from localStorage with no flash of the default).

- [ ] **Step 4: Commit**

```bash
git add docs/06-ui-spec.md
git commit -m "Record the UI-preferences exception to the no-browser-storage rule"
```

---

## Self-review notes

- Spec coverage: settings hook + persistence (Task 1), no-flash (Task 2), 6 themes with Overdrive glow (Task 3), dial metric (Task 4), settings panel (Task 5), 3 layouts (Task 6), compact summary for Instruments focus (Task 7), rule-change doc (Task 8).
- The naming wart (`--amber` holding non-amber values) is documented in Task 3's comment.
- Print is protected: Task 7 adds `.invoice-summary` to the print-hide list; no theme touches paper tokens.
- The one visual-judgment risk is the Invoice-focus heading hide in Task 6, flagged for the implementer to verify against the real DOM rather than guess.

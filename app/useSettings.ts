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

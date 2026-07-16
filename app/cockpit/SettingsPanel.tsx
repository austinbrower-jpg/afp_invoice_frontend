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

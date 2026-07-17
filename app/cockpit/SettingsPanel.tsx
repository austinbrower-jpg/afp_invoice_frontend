"use client";

// The settings panel: a gear button in the topbar that opens a popover to pick theme, layout, and
// the dial metric. Applies live via the useSettings setters. Keyboard accessible: focus is
// visible (the console focus ring applies), Escape closes.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Settings, ThemeName, LayoutName, DialMetric } from "../useSettings";

const THEMES: { id: ThemeName; label: string }[] = [
  { id: "station", label: "Station" },
  { id: "ion", label: "Ion" },
  { id: "ember", label: "Ember" },
  { id: "daylight", label: "Daylight" },
  // id stays "overdrive" so saved selections keep resolving; the theme was retuned from
  // neon magenta to an ice-blue "Glacier" palette on 2026-07-17.
  { id: "overdrive", label: "Glacier" },
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
  // Anchor coordinates for the popover, measured off the gear button once it opens. The
  // popover itself is portaled to <body> (see below) so it escapes the topbar, whose
  // backdrop-filter otherwise turns it into the containing block for any position:fixed
  // descendant, silently repositioning "the viewport" to "the 60px-tall topbar" and
  // pinning the popover to the top of the page instead of under the gear.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
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
        ref={btnRef}
        className="gear"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Simple gear glyph, no icon dependency */}
        <span aria-hidden="true">&#9881;</span>
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            className="settings-pop"
            role="dialog"
            aria-label="Console settings"
            ref={popRef}
            style={{ top: anchor.top, right: anchor.right }}
          >
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
          </div>,
          document.body
        )}
    </div>
  );
}

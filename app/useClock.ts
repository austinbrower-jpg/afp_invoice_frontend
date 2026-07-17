"use client";

// Owns the live clock. Only this in-progress value is persisted, under one localStorage key,
// per the browser-storage amendment in docs/06-ui-spec.md. A completed session goes to Notion
// through POST /api/clock and never to the browser. On a failed save the running clock is
// kept, so nothing is lost.

import { useCallback, useEffect, useRef, useState } from "react";
import { todayISO } from "@/lib/invoice";
import { sessionId, to12h, hoursBetween, type ClockPayload } from "@/lib/clock";

const KEY = "afp.clock.v1";

export type ClockState = { startedAt: number; dateISO: string; location: string };

function read(): ClockState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p && typeof p.startedAt === "number" &&
      typeof p.dateISO === "string" && typeof p.location === "string"
    ) {
      return { startedAt: p.startedAt, dateISO: p.dateISO, location: p.location };
    }
  } catch {
    // fall through
  }
  return null;
}

export function useClock(onSaved: () => void) {
  const [state, setState] = useState<ClockState | null>(null);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const inFlightRef = useRef(false);

  // Resume a running clock after mount. localStorage is client only, so this cannot run during
  // render or on the server.
  useEffect(() => {
    const s = read();
    if (s) {
      setState(s);
      setNow(Date.now());
    }
  }, []);

  // Tick once a second while clocked in, for the elapsed readout.
  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const clockIn = useCallback((location: string) => {
    if (state) return;
    const s: ClockState = { startedAt: Date.now(), dateISO: todayISO(), location };
    window.localStorage.setItem(KEY, JSON.stringify(s));
    setError(null);
    setState(s);
    setNow(Date.now());
  }, [state]);

  const discard = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setState(null);
    setError(null);
  }, []);

  const clockOut = useCallback(async () => {
    if (!state || inFlightRef.current) return;
    inFlightRef.current = true;
    const start = new Date(state.startedAt);
    const endMs = Date.now();
    const end = new Date(endMs);
    const payload: ClockPayload = {
      dateISO: state.dateISO,
      sessionId: sessionId(
        state.dateISO, start.getHours(), start.getMinutes(), end.getHours(), end.getMinutes()
      ),
      startDisplay: to12h(start.getHours(), start.getMinutes()),
      endDisplay: to12h(end.getHours(), end.getMinutes()),
      hours: hoursBetween(state.startedAt, endMs),
      location: state.location,
    };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body && body.error ? String(body.error) : `Save failed (HTTP ${res.status}).`);
        return; // keep the running clock; nothing is lost
      }
      window.localStorage.removeItem(KEY);
      setState(null);
      onSavedRef.current();
    } catch {
      setError("Could not reach the server. Your clock is still running.");
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }, [state]);

  const stale = Boolean(state && state.dateISO !== todayISO());
  const elapsedMs = state ? Math.max(0, now - state.startedAt) : 0;

  return { state, elapsedMs, stale, saving, error, clockIn, clockOut, discard };
}

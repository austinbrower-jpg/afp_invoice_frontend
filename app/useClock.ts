"use client";

// Owns the live clock. As of 2026-07-17 the running clock lives in Notion (on the Client page,
// via GET /api/notion/afp -> payload.activeClock), not in localStorage, so a clock-in on the
// phone shows up on the laptop and can be clocked out there. This hook is now server-driven: it
// adopts the activeClock from the payload, applies optimistic updates so the button feels
// instant, and lets the next refresh confirm. A completed session still goes to Notion through
// POST /api/clock and is inserted once, never updated.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveClock } from "@/lib/notion";
import { completeSession, zonedParts, zonedDateISO, type ClockPayload } from "@/lib/clock";

export type ClockState = { startedAt: number; location: string };

const toState = (a: ActiveClock | null): ClockState | null =>
  a ? { startedAt: Date.parse(a.startedAt), location: a.location } : null;

const todayInZone = (tz: string): string => zonedDateISO(zonedParts(Date.now(), tz));

export function useClock(activeClock: ActiveClock | null, timezone: string, onSaved: () => void) {
  const server = toState(activeClock);
  const [state, setState] = useState<ClockState | null>(server);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const inFlightRef = useRef(false);

  // Adopt the server value only when it actually changes, so an optimistic update set below is
  // not clobbered by a poll that raced the write. The key is the ISO instant (or "" for no
  // clock); when it flips, a real refresh has landed and its value wins.
  const serverKey = activeClock ? activeClock.startedAt : "";
  const lastKeyRef = useRef(serverKey);
  useEffect(() => {
    if (serverKey !== lastKeyRef.current) {
      lastKeyRef.current = serverKey;
      setState(toState(activeClock));
    }
    // activeClock is captured through serverKey; adopting on key change is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  // Tick once a second while clocked in, for the elapsed readout.
  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const clockIn = useCallback(
    async (location: string) => {
      if (state || inFlightRef.current) return;
      inFlightRef.current = true;
      setStarting(true);
      setError(null);
      try {
        const res = await fetch("/api/clock/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ location }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body && body.error ? String(body.error) : `Clock in failed (HTTP ${res.status}).`);
          return;
        }
        // Optimistic: show the running clock now; the next refresh confirms the same instant.
        setState({ startedAt: Date.parse(body.startedAt), location: body.location });
        setNow(Date.now());
        onSavedRef.current();
      } catch {
        setError("Could not reach the server. Try again.");
      } finally {
        setStarting(false);
        inFlightRef.current = false;
      }
    },
    [state]
  );

  const discard = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    try {
      const res = await fetch("/api/clock/discard", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body && body.error ? String(body.error) : `Discard failed (HTTP ${res.status}).`);
        return;
      }
      setState(null);
      onSavedRef.current();
    } catch {
      setError("Could not reach the server. Your clock is still running.");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const clockOut = useCallback(async () => {
    if (!state || inFlightRef.current) return;
    inFlightRef.current = true;
    const payload: ClockPayload = completeSession(
      state.startedAt,
      Date.now(),
      timezone,
      state.location
    );
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
      setState(null); // optimistic; the refresh confirms activeClock is now null
      onSavedRef.current();
    } catch {
      setError("Could not reach the server. Your clock is still running.");
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  }, [state, timezone]);

  const stale = Boolean(state && zonedDateISO(zonedParts(state.startedAt, timezone)) !== todayInZone(timezone));
  const elapsedMs = state ? Math.max(0, now - state.startedAt) : 0;

  return { state, elapsedMs, stale, saving, starting, error, clockIn, clockOut, discard };
}

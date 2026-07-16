"use client";

// Keeps a page in sync with Notion without a webhook, a background job, or a database, none
// of which this tool builds (docs/05-api-routes.md). Notion is edited by hand, so the moment
// staleness actually matters is when the user switches from a Notion tab back to this app.
// This hook refetches on window focus and on a slow interval, plus a manual refresh.
//
// Every refetch hits GET /api/notion/afp, which is itself cached for 60s on the server, so
// Notion is queried at most about once a minute no matter how often the client polls. The
// client cache is bypassed with no-store so a deliberate refresh is never served a stale
// browser copy while the server cache still shields Notion's rate limit.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Payload } from "@/lib/notion";

export type AfpError = { error: string; hint?: string };

// Poll cadence. Long enough that it never races the 60s server cache into extra Notion
// calls, short enough that a page left open drifts by at most this much before catching up.
const POLL_MS = 45_000;
// A focus event just after a sync should not trigger a second fetch. Debounce focus-driven
// refetches to only fire when the data is at least this old.
const FOCUS_MIN_AGE_MS = 12_000;

export type AfpData = {
  data: Payload | null;
  error: AfpError | null;
  lastSynced: number | null; // epoch ms of the last successful fetch, null until first
  refreshing: boolean; // a fetch is in flight over already-loaded data
  loading: boolean; // the very first load, nothing to show yet
  refresh: () => void;
};

export function useAfpData(initial?: Payload | null, initialError?: AfpError | null): AfpData {
  const [data, setData] = useState<Payload | null>(initial ?? null);
  const [error, setError] = useState<AfpError | null>(initialError ?? null);
  // Null until a real client fetch lands, even when seeded. A server seed can be up to 60s
  // old under ISR, so dating it "now" at mount would let the pill claim "SYNCED just now" for
  // stale data. The seed still paints instantly; the pill shows a neutral "LIVE" for the blink
  // before the mount fetch below sets an honest timestamp.
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const liveRef = useRef(true);
  const inFlightRef = useRef(false);
  const lastSyncedRef = useRef<number | null>(null);

  const fetchNow = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const res = await fetch("/api/notion/afp", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!liveRef.current) return;
      if (!res.ok) {
        if (res.status === 401) {
          setError({
            error: "Session expired.",
            hint: "Reload the page to sign in again.",
          });
        } else if (body && typeof body === "object" && "error" in body) {
          setError(body as AfpError);
        } else {
          setError({ error: "Notion read failed.", hint: `HTTP ${res.status}` });
        }
        return;
      }
      const now = Date.now();
      setData(body as Payload);
      setError(null);
      setLastSynced(now);
      lastSyncedRef.current = now;
    } catch (e) {
      if (!liveRef.current) return;
      setError({ error: "Could not reach /api/notion/afp.", hint: String(e) });
    } finally {
      if (liveRef.current) setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchNow();
  }, [fetchNow]);

  useEffect(() => {
    liveRef.current = true;

    // Always confirm against a real fetch on mount, even when seeded. The seed gives an
    // instant first paint with no spinner; this immediate fetch replaces it in place and,
    // more importantly, stamps lastSynced with an actual read time so the pill is honest.
    void fetchNow();

    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchNow();
    }, POLL_MS);

    const onFocus = () => {
      const age = lastSyncedRef.current ? Date.now() - lastSyncedRef.current : Infinity;
      if (age >= FOCUS_MIN_AGE_MS) void fetchNow();
    };
    const onVisible = () => {
      if (!document.hidden) onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      liveRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Intentionally run once. `initial` is a boot seed; later identity changes must not
    // tear down polling. fetchNow is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNow]);

  return {
    data,
    error,
    lastSynced,
    refreshing,
    loading: data === null && error === null,
    refresh,
  };
}

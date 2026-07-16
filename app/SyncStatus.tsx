"use client";

// The freshness readout the hours-worked prototype sketched as "Notion synced 14s ago",
// built as a real instrument. A dot carries the state (settled / refreshing / stale /
// failed) and the mono label carries the age. The relative time only renders after mount so
// the server and client markup agree; before that it shows a neutral "LIVE" so there is no
// hydration flash. See app/useAfpData.ts for where the timestamp comes from.

import { useEffect, useState } from "react";

function relTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function SyncStatus({
  lastSynced,
  refreshing,
  error,
  onRefresh,
}: {
  lastSynced: number | null;
  refreshing: boolean;
  error: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);

  // Client-only ticking. Starts null on the server, fills in after mount, then updates on a
  // slow cadence so "12s ago" stays roughly honest without a per-second render.
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const ageMs = now !== null && lastSynced !== null ? now - lastSynced : null;
  const stale = ageMs !== null && ageMs > 90_000;

  const state = error ? "err" : refreshing ? "sync" : stale ? "stale" : "ok";
  const label = error
    ? "SYNC FAILED"
    : now === null || lastSynced === null
    ? "LIVE"
    : `SYNCED ${relTime(ageMs as number)}`;

  return (
    <div className={`syncpill ${state}`}>
      <span className="syncdot" aria-hidden="true" />
      <span className="mono">{label}</span>
      <button
        type="button"
        className="syncbtn"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh from Notion"
        title="Refresh from Notion"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5V5H11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

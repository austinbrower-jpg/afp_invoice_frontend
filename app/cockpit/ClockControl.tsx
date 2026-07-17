"use client";

import { useState } from "react";
import { useClock } from "@/app/useClock";
import { elapsed, to12h, zonedParts } from "@/lib/clock";
import type { ActiveClock } from "@/lib/notion";
import { ClockControlView } from "./ClockControlView";

const LOCATIONS = ["Remote", "Onsite / AFP"] as const;

export default function ClockControl({
  activeClock,
  timezone,
  onSaved,
}: {
  activeClock: ActiveClock | null;
  timezone: string;
  onSaved: () => void;
}) {
  const { state, elapsedMs, stale, saving, starting, error, clockIn, clockOut, discard } = useClock(
    activeClock,
    timezone,
    onSaved
  );
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  // The start label is resolved in the business timezone off the absolute instant, so it reads
  // the same on the phone and the laptop regardless of either device's timezone.
  const startLabel = state ? (() => {
    const p = zonedParts(state.startedAt, timezone);
    return to12h(p.hour, p.minute);
  })() : "";
  return (
    <ClockControlView
      clockedIn={Boolean(state)}
      elapsedLabel={elapsed(elapsedMs)}
      startLabel={startLabel}
      stale={stale}
      saving={saving}
      starting={starting}
      error={error}
      location={location}
      locations={LOCATIONS}
      onLocation={setLocation}
      onClockIn={() => void clockIn(location)}
      onClockOut={() => void clockOut()}
      onDiscard={() => void discard()}
    />
  );
}

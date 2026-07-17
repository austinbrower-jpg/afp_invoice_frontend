"use client";

import { useState } from "react";
import { useClock } from "@/app/useClock";
import { elapsed, to12h } from "@/lib/clock";
import { ClockControlView } from "./ClockControlView";

const LOCATIONS = ["Remote", "Onsite / AFP"] as const;

export default function ClockControl({ onSaved }: { onSaved: () => void }) {
  const { state, elapsedMs, stale, saving, error, clockIn, clockOut, discard } = useClock(onSaved);
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const start = state ? new Date(state.startedAt) : null;
  return (
    <ClockControlView
      clockedIn={Boolean(state)}
      elapsedLabel={elapsed(elapsedMs)}
      startLabel={start ? to12h(start.getHours(), start.getMinutes()) : ""}
      stale={stale}
      saving={saving}
      error={error}
      location={location}
      locations={LOCATIONS}
      onLocation={setLocation}
      onClockIn={() => clockIn(location)}
      onClockOut={() => void clockOut()}
      onDiscard={discard}
    />
  );
}

// Pure, client-safe clock helpers. No import from lib/notion.ts: this module ships in the
// client bundle and must never pull in the Notion client or NOTION_TOKEN. Times are
// formatted the same way lib/notion.ts formats read times, so a clocked session reads like
// every hand-entered one ("9:03 AM").

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function hhmm(h: number, m: number): string {
  return `${pad2(h)}${pad2(m)}`;
}

export function to12h(h: number, m: number): string {
  const mer = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m)} ${mer}`;
}

// Break an absolute instant into wall-clock parts in a specific IANA timezone. The clock
// stores the clock-in as an absolute instant, so the displayed start and end must be
// resolved in the business timezone (America/Chicago, from the client's Timezone property),
// not in whatever timezone the device happens to be set to. Doing it here, off the instant,
// is what keeps a session read the same on the phone and the laptop and stops the times from
// drifting by the device-versus-business offset. Uses Intl, which is present in the browser
// and in Node. Falls back to the device local time when the zone is missing or unrecognized,
// rather than throwing.
export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

export function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const d = new Date(instantMs);
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      return {
        year: Number(get("year")),
        month: Number(get("month")),
        day: Number(get("day")),
        // Some engines emit "24" for midnight under hour12:false. Fold it back to 0.
        hour: Number(get("hour")) % 24,
        minute: Number(get("minute")),
      };
    } catch {
      // Unrecognized zone: fall through to local.
    }
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

export function zonedDateISO(p: ZonedParts): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

// The completed session an in-progress clock becomes when it stops. Pure: both instants and
// the zone in, one validated ClockPayload out, so the same computation can be unit tested and
// reused by the clock control without duplicating the timezone math.
export function completeSession(
  startMs: number,
  endMs: number,
  timeZone: string,
  location: string
): ClockPayload {
  const sp = zonedParts(startMs, timeZone);
  const ep = zonedParts(endMs, timeZone);
  const dateISO = zonedDateISO(sp);
  return {
    dateISO,
    sessionId: sessionId(dateISO, sp.hour, sp.minute, ep.hour, ep.minute),
    startDisplay: to12h(sp.hour, sp.minute),
    endDisplay: to12h(ep.hour, ep.minute),
    hours: hoursBetween(startMs, endMs),
    location,
  };
}

export function sessionId(dateISO: string, sh: number, sm: number, eh: number, em: number): string {
  return `AFP-${dateISO}-${hhmm(sh, sm)}-${hhmm(eh, em)}`;
}

export function hoursBetween(startMs: number, endMs: number): number {
  return (endMs - startMs) / 3_600_000;
}

export function elapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

export type ClockPayload = {
  dateISO: string;
  sessionId: string;
  startDisplay: string;
  endDisplay: string;
  hours: number;
  location: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HOURS = 24;

export function validateClockPayload(
  body: unknown
): { ok: true; value: ClockPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object." };
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const dateISO = str("dateISO");
  const sessionId = str("sessionId");
  const startDisplay = str("startDisplay");
  const endDisplay = str("endDisplay");
  const location = str("location");
  const hours = typeof b.hours === "number" ? b.hours : NaN;

  if (!ISO_DATE.test(dateISO)) return { ok: false, error: "dateISO must be YYYY-MM-DD." };
  if (!sessionId) return { ok: false, error: "sessionId is required." };
  if (!startDisplay || !endDisplay) return { ok: false, error: "start and end times are required." };
  if (!location) return { ok: false, error: "location is required." };
  if (!Number.isFinite(hours) || hours <= 0 || hours >= MAX_HOURS) {
    return { ok: false, error: "hours must be greater than 0 and less than 24." };
  }
  return { ok: true, value: { dateISO, sessionId, startDisplay, endDisplay, hours, location } };
}

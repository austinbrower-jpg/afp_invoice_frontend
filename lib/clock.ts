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

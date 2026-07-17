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

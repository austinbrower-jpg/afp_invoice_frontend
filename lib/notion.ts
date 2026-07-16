// Server-side only. NOTION_TOKEN must never reach the client bundle.
// Schema is verified live and documented in docs/03-notion-schema.md. Do not guess
// at property names. The Payload shape is the contract in docs/04-data-contract.md.

import { Client } from "@notionhq/client";

export type Session = {
  url: string; // Notion page URL. The stable key. Never use Session ID as a key.
  date: string; // "2026-07-15"
  sid: string; // Session ID, human-entered, display only
  start: string; // normalized on read, see normalizeTime
  end: string;
  brk: number | null; // Break (min)
  hours: number; // raw float from Total Hours, unrounded
  rate: number;
  billable: boolean;
  status: string; // Billing Status, verbatim
  location: string | null;
  work: string[]; // Work Done page IDs, dashes stripped
  notes: string | null;
};

export type WorkDone = {
  title: string;
  date: string;
  includeInInvoice: boolean;
  approval: string; // Approval Status, verbatim
  summary: string;
  invoice: string; // Invoice Description, the prose that prints
};

export type Payload = {
  client: {
    name: string;
    defaultRate: number;
    timezone: string;
    billTo: string;
  };
  from: string;
  lastInvoice: { number: string; periodEnd: string } | null;
  hours: Session[];
  workDone: Record<string, WorkDone>;
};

// Gap 4 in docs/07-data-gaps.md. Neither block exists in Notion.
//
// The remit-to side is settled: docs/09-brand.md decides Battle Bound Branding LLC is
// the contracting entity, so this is a known constant that lives here rather than in
// Notion, because it is ours and not the client's. The address fields are still
// placeholders. AFP's side is entirely unknown and still blocks sending a real invoice.
// Both render as editable blocks on the paper until the Client row gains Billing
// Address and AP Contact properties.
const FROM_BLOCK = [
  "Battle Bound Branding LLC",
  "[street address]",
  "San Antonio, TX [zip]",
  "[email] · [phone]",
].join("\n");

const BILL_TO_BLOCK = [
  "Anytime Fuel Pros",
  "[street address]",
  "[city, state zip]",
  "[AP contact / email]",
].join("\n");

export class NotionDataError extends Error {
  readonly hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.name = "NotionDataError";
    this.hint = hint;
  }
}

const stripDashes = (s: string) => s.replace(/-/g, "");

// Notion returns page identifiers inconsistently across surfaces: the REST relation
// value is a dashed UUID, other surfaces hand back a page URL with the id trailing.
// Normalize both to a bare 32-char id so the two sides of the join can be compared.
// This is the single most likely source of a silent mismatch. See docs/04.
export function toPageId(raw: string): string {
  const bare = stripDashes(raw.trim());
  const match = bare.match(/[0-9a-f]{32}(?![0-9a-f])/i);
  return match ? match[0].toLowerCase() : bare.toLowerCase();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Start Time and End Time are free text and drift between "7:00 AM" and "07:00"
// because they are hand entered. See gap 5. Normalize to one display format on read
// so the invoice is consistent and the day trace has a single format to parse.
// Never write the correction back to Notion.
export function normalizeTime(raw: string): string {
  const s = raw.trim();
  if (!s) return "";

  const twelve = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (twelve) {
    const [, h, m, mer] = twelve;
    let hour = Number(h) % 12;
    if (mer.toLowerCase() === "p") hour += 12;
    return toDisplay(hour, Number(m));
  }

  const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const [, h, m] = twentyFour;
    return toDisplay(Number(h), Number(m));
  }

  // Unrecognized. Pass through rather than invent a time.
  return s;
}

function toDisplay(hour24: number, minute: number): string {
  const mer = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${mer}`;
}

/* ---------- property readers ---------- */

type Props = Record<string, any>;

const text = (p: Props, key: string): string => {
  const v = p[key];
  if (!v) return "";
  const rich = v.rich_text ?? v.title;
  if (!Array.isArray(rich)) return "";
  return rich.map((x: any) => x.plain_text ?? "").join("");
};

const textOrNull = (p: Props, key: string): string | null => {
  const s = text(p, key).trim();
  return s === "" ? null : s;
};

const num = (p: Props, key: string): number | null => p[key]?.number ?? null;

// The REST API returns a real boolean. Other Notion surfaces serialize checkboxes as
// __YES__ / __NO__, so accept those too rather than silently reading them as false.
const bool = (p: Props, key: string): boolean => {
  const v = p[key]?.checkbox;
  if (typeof v === "boolean") return v;
  if (v === "__YES__") return true;
  return false;
};

const select = (p: Props, key: string): string => p[key]?.select?.name ?? "";

const dateStart = (p: Props, key: string): string =>
  p[key]?.date?.start?.slice(0, 10) ?? "";

const relationIds = (p: Props, key: string): string[] =>
  (p[key]?.relation ?? []).map((r: any) => toPageId(r.id ?? ""));

/* ---------- fetch ---------- */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new NotionDataError(
      `Missing ${name}.`,
      "Copy .env.example to .env.local and fill it in. See docs/08-deploy.md."
    );
  }
  return v;
}

async function queryAll(client: Client, dataSourceId: string) {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await client.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results;
}

export async function fetchPayload(): Promise<Payload> {
  const client = new Client({ auth: requireEnv("NOTION_TOKEN") });

  // Three data sources, plus Clients. One query each, joined once here, never per row.
  // Notion rate limits at roughly 3 requests per second. See docs/05-api-routes.md.
  const [hoursRows, workRows, invoiceRows, clientRows] = await Promise.all([
    queryAll(client, requireEnv("NOTION_DS_HOURS")),
    queryAll(client, requireEnv("NOTION_DS_WORK")),
    queryAll(client, requireEnv("NOTION_DS_INVOICES")),
    queryAll(client, requireEnv("NOTION_DS_CLIENTS")),
  ]);

  // Zero rows everywhere is almost never a code bug. It means the integration was
  // never shared with the Invoice Details page, and every query returns empty with no
  // error. Say so rather than rendering an empty invoice. See docs/08-deploy.md.
  if (
    hoursRows.length === 0 &&
    workRows.length === 0 &&
    invoiceRows.length === 0
  ) {
    throw new NotionDataError(
      "Notion returned zero rows across Hours Worked, Work Done, and Invoice Reports.",
      "The integration is almost certainly not shared with the 'Invoice Details' page. " +
        "Share it, then reload. The three databases inherit access from that parent. " +
        "See docs/08-deploy.md."
    );
  }

  const workDone: Record<string, WorkDone> = {};
  for (const row of workRows) {
    const p = row.properties as Props;
    workDone[toPageId(row.id)] = {
      title: text(p, "Title"),
      date: dateStart(p, "Date"),
      includeInInvoice: bool(p, "Include in Invoice"),
      approval: select(p, "Approval Status"),
      summary: text(p, "Summary"),
      invoice: text(p, "Invoice Description"),
    };
  }

  const hours: Session[] = hoursRows.map((row) => {
    const p = row.properties as Props;
    return {
      url: row.url,
      date: sessionDate(p),
      sid: text(p, "Session ID"),
      start: normalizeTime(text(p, "Start Time")),
      end: normalizeTime(text(p, "End Time")),
      brk: num(p, "Break (min)"),
      hours: num(p, "Total Hours") ?? 0, // raw float, the browser rounds
      rate: num(p, "Hourly Rate") ?? 0,
      billable: bool(p, "Billable"),
      status: select(p, "Billing Status"),
      location: textOrNull(p, "Location"),
      work: relationIds(p, "Related Work Done"),
      notes: textOrNull(p, "Notes"),
    };
  });

  assertDatesUsable(hours);
  hours.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    client: readClient(clientRows),
    from: FROM_BLOCK,
    lastInvoice: readLastInvoice(invoiceRows),
    hours,
    workDone,
  };
}

// The seam for gap 1 in docs/07-data-gaps.md, now closed. Session Date is a real date
// property as of 2026-07-16, backfilled and verified against every Date title, so read
// it rather than the title. The title stays as the human-readable label. The Payload is
// identical either way, which is why this swap moved nothing downstream.
function sessionDate(p: Props): string {
  return dateStart(p, "Session Date");
}

// Kept after gap 1 closed, on purpose. A real date type means a row can no longer hold
// "7/15/26", but it can still hold nothing at all, and an empty Session Date would sort
// out of every range and drop a billable session with no error and no flag, which is the
// same failure the gap described. Entry is still manual and will drift again. Refuse to
// serve rather than quietly drop a session. See docs/07-data-gaps.md.
function assertDatesUsable(hours: Session[]): void {
  const bad = hours.filter((h) => !ISO_DATE.test(h.date));
  if (bad.length === 0) return;
  const named = bad.map((h) => `${h.sid || "(no Session ID)"} -> "${h.date}"`);
  throw new NotionDataError(
    `${bad.length} Hours Worked row(s) have no usable Session Date: ${named.join(", ")}`,
    "Session Date is empty or unreadable on those rows, so they would sort out of every " +
      "date range and silently drop off the invoice. Fill it in Notion. The Date title " +
      "is the human-readable label and is not used for filtering. See docs/07-data-gaps.md."
  );
}

function readClient(rows: any[]): Payload["client"] {
  const wanted = process.env.NOTION_CLIENT_PAGE
    ? toPageId(process.env.NOTION_CLIENT_PAGE)
    : null;
  const row = rows.find((r) => toPageId(r.id) === wanted) ?? rows[0];
  if (!row) {
    throw new NotionDataError(
      "No Clients row found.",
      "Expected the Anytime Fuel Pros row. Check NOTION_DS_CLIENTS and that the " +
        "integration can read the Clients database. See docs/08-deploy.md."
    );
  }
  const p = row.properties as Props;
  return {
    name: text(p, "Name"),
    defaultRate: num(p, "Default Hourly Rate") ?? 0,
    timezone: text(p, "Timezone"),
    billTo: BILL_TO_BLOCK,
  };
}

// The Invoice Reports row with the highest Invoice Number, sorted as a string. Used to
// default the range to everything since the last invoice and to suggest the next
// number. Null when Invoice Reports is empty, and the UI falls back to the current
// month. See docs/04-data-contract.md.
function readLastInvoice(rows: any[]): Payload["lastInvoice"] {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const an = text(a.properties, "Invoice Number");
    const bn = text(b.properties, "Invoice Number");
    return an < bn ? 1 : an > bn ? -1 : 0;
  });
  const p = sorted[0].properties as Props;
  return {
    number: text(p, "Invoice Number"),
    periodEnd: dateStart(p, "Period End"),
  };
}

import Link from "next/link";
import { fetchPayload, NotionDataError } from "@/lib/notion";
import { HoursGauge } from "./HoursGauge";

// Scoped to what the hours gauge needs, per docs/10-visual-direction.md. Not a
// general-purpose dashboard: no other Notion-tracking-app sections (Clients, Work
// Stuff, Settings) belong here until there is a reason beyond wanting them. See
// CLAUDE.md's scope discipline.

// 60 hours/month, chosen to match the twice-a-month billing cadence CLAUDE.md
// describes, not a value Notion stores or docs/10 specifies. Change here if it stops
// fitting how the hours actually run.
const MONTHLY_TARGET_HOURS = 60;

// Without this, a Server Component with no dynamic API calls gets statically
// generated once at build time, and the gauge would freeze on whatever hours existed
// at the last deploy. Same 60s window as /api/notion/afp, per docs/05-api-routes.md:
// cache aggressively, since nothing here can invalidate itself, but never go fully
// static on live Notion data.
export const revalidate = 60;

export default async function DashboardPage() {
  let hoursThisMonth = 0;
  let error: { error: string; hint?: string } | null = null;

  try {
    const payload = await fetchPayload();
    // A low-stakes visual figure, not a billing calculation like the invoice's date
    // range: plain server-local "now" is fine here, unlike the client-side todayISO()
    // the invoice builder uses for actual money math.
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    hoursThisMonth = payload.hours
      .filter((h) => h.date.startsWith(ym) && h.status !== "Superseded")
      .reduce((s, h) => s + h.hours, 0);
  } catch (err) {
    error =
      err instanceof NotionDataError
        ? { error: err.message, hint: err.hint }
        : { error: "Notion read failed.", hint: String(err) };
  }

  return (
    <div className="station">
      <div className="topbar">
        <div className="brand">
          <b>Dashboard</b>
        </div>
        <Link href="/" className="chip" style={{ marginLeft: "auto" }}>
          Invoice Builder
        </Link>
      </div>

      <main className="dashboard-main">
        {error ? (
          <div className="dash-error">
            <b>Notion read failed.</b>
            <div>{error.error}</div>
            {error.hint && <div className="hint">{error.hint}</div>}
          </div>
        ) : (
          <div className="dash-card">
            <h2 className="eyebrow">Hours this month</h2>
            <HoursGauge hours={hoursThisMonth} target={MONTHLY_TARGET_HOURS} />
          </div>
        )}
      </main>
    </div>
  );
}

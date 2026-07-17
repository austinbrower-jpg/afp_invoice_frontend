// POST /api/clock/discard. Cancels the running clock without writing a session, added
// 2026-07-17 with clock-in (cross-device clock, approach A). Gated by middleware.ts. This is
// the shared-state counterpart to the old local "Discard": it clears the Active Clock
// properties on the Client page so a mistaken or stale clock-in can be thrown away from any
// device. It never inserts a Hours Worked row.

import { revalidatePath } from "next/cache";
import { clearActiveClock } from "@/lib/notion";

export async function POST() {
  try {
    await clearActiveClock();
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "Notion write failed.",
        hint:
          "If this is a permissions error, enable Update content on the integration. See docs/08-deploy.md. " +
          hint,
      },
      { status: 502 }
    );
  }
  revalidatePath("/api/notion/afp");
  return Response.json({ ok: true }, { status: 200 });
}

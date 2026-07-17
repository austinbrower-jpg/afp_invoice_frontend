// POST /api/clock/start. The clock-in route, added 2026-07-17 (cross-device clock, approach A,
// owner-approved). Gated by middleware.ts like every non-open path. It stamps the running clock
// onto the Client page so it is shared across devices, then revalidates the read so other
// devices pick it up. The start instant is stamped server side, not sent by the client, so a
// wrong device clock cannot skew it. Idempotent enough for one user: a second clock-in just
// overwrites the start, which is the desired "restart" behavior.

import { revalidatePath } from "next/cache";
import { setActiveClock } from "@/lib/notion";

const LOCATIONS = new Set(["Remote", "Onsite / AFP"]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const location =
    body && typeof body === "object" && typeof (body as any).location === "string"
      ? (body as any).location.trim()
      : "";
  if (!LOCATIONS.has(location)) {
    return Response.json({ error: "Unknown location." }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  try {
    await setActiveClock(startedAt, location);
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
  return Response.json({ startedAt, location }, { status: 201 });
}

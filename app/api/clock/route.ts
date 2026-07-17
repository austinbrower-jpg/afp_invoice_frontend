// POST /api/clock. The clock-out route, added 2026-07-16. Gated by middleware.ts like every
// non-open path, so an unauthenticated call 401s before reaching here. It inserts one Draft
// Hours Worked row (insert only, never updated) and then clears the shared running clock on
// the Client page, so clocking out on any device ends the session everywhere. Clearing is
// best effort: the billing row is the artifact that must not be lost, so a failed clear still
// returns success with a warning rather than throwing the completed session away.
// See docs/05-api-routes.md.

import { revalidatePath } from "next/cache";
import { validateClockPayload } from "@/lib/clock";
import { insertSession, clearActiveClock } from "@/lib/notion";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = validateClockPayload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  let id: string;
  try {
    ({ id } = await insertSession(parsed.value));
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Notion write failed.", hint: "If this is a permissions error, enable Insert content on the integration. See docs/08-deploy.md." + " " + hint },
      { status: 502 }
    );
  }
  let warning: string | undefined;
  try {
    await clearActiveClock();
  } catch (err) {
    // The session is already saved; surface the stuck clock but do not fail the request.
    warning =
      "Session saved, but the running clock could not be cleared. " +
      (err instanceof Error ? err.message : String(err));
  }
  revalidatePath("/api/notion/afp");
  return Response.json(warning ? { id, warning } : { id }, { status: 201 });
}

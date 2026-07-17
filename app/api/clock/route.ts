// POST /api/clock. The one write route, added 2026-07-16. Gated by middleware.ts like every
// non-open path, so an unauthenticated call 401s before reaching here. Insert only: it writes
// one Draft Hours Worked row and revalidates the read so the session appears at once.
// See docs/05-api-routes.md.

import { revalidatePath } from "next/cache";
import { validateClockPayload } from "@/lib/clock";
import { insertSession } from "@/lib/notion";

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
  try {
    const { id } = await insertSession(parsed.value);
    revalidatePath("/api/notion/afp");
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Notion write failed.", hint: "If this is a permissions error, enable Insert content on the integration. See docs/08-deploy.md." + " " + hint },
      { status: 502 }
    );
  }
}

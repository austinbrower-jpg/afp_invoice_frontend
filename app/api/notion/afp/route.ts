// GET /api/notion/afp
//
// The read route. Read-only itself: it never writes. The app's writes live in the sanctioned
// clock routes (POST /api/clock, /api/clock/start, /api/clock/discard), each of which
// revalidates this path so a clock change shows up here on the next fetch. This route also
// carries the shared running clock (payload.activeClock) so every device reads the same clock.
// See docs/05-api-routes.md.

import { fetchPayload, NotionDataError } from "@/lib/notion";

// Cached for 60s to shield Notion's rate limit, and busted on demand by the clock routes'
// revalidatePath("/api/notion/afp") the moment a clock-in, clock-out, or discard writes, so a
// clock change is never hidden behind the cache.
export const revalidate = 60;

export async function GET() {
  try {
    const payload = await fetchPayload();
    return Response.json(payload);
  } catch (err) {
    if (err instanceof NotionDataError) {
      return Response.json(
        { error: err.message, hint: err.hint },
        { status: 502 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "Notion read failed.",
        hint: message,
      },
      { status: 502 }
    );
  }
}

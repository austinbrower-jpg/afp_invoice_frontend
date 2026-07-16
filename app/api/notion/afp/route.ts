// GET /api/notion/afp
//
// The only route. Read-only: Notion is updated by hand on the Notion side, so there is
// no POST, PATCH, or DELETE here and there never will be without a new decision.
// See docs/05-api-routes.md.

import { fetchPayload, NotionDataError } from "@/lib/notion";

// Nothing this app does can invalidate the data, because it never writes. Cache hard
// and share one fetch across every route rather than fetching per page.
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

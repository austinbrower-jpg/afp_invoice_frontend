import { fetchPayload, NotionDataError, type Payload } from "@/lib/notion";
import { Dashboard } from "./Dashboard";

// Server-render the first payload so the panel paints with real figures instead of a
// spinner, then the client's useAfpData takes over and keeps it synced with Notion on focus
// and on a slow interval. Same 60s window as /api/notion/afp: cache aggressively, since
// nothing here writes, but never go fully static on live Notion data. See docs/05-api-routes.md.
export const revalidate = 60;

export default async function DashboardPage() {
  let initialData: Payload | null = null;
  let initialError: { error: string; hint?: string } | null = null;

  try {
    initialData = await fetchPayload();
  } catch (err) {
    initialError =
      err instanceof NotionDataError
        ? { error: err.message, hint: err.hint }
        : { error: "Notion read failed.", hint: String(err) };
  }

  return <Dashboard initialData={initialData} initialError={initialError} />;
}

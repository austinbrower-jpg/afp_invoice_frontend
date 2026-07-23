import { revalidatePath } from "next/cache";
import { updateSessionBilling, type BillingStatus } from "@/lib/notion";

const statuses = new Set<BillingStatus>(["unbilled", "invoiced", "paid"]);

type Body = { sessionIds?: unknown; status?: unknown; invoiceNumber?: unknown };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const sessionIds = Array.isArray(body.sessionIds)
    ? body.sessionIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const status = body.status;
  if (!sessionIds.length || typeof status !== "string" || !statuses.has(status as BillingStatus)) {
    return Response.json({ error: "Expected sessionIds and a valid billing status." }, { status: 400 });
  }
  const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : null;
  await updateSessionBilling(sessionIds, status as BillingStatus, invoiceNumber || undefined);
  revalidatePath("/api/notion/afp");
  return Response.json({ ok: true });
}

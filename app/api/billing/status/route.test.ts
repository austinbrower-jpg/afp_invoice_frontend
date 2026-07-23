import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notion", () => ({
  updateSessionBilling: vi.fn(async () => {}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/billing/status/route";
import { updateSessionBilling } from "@/lib/notion";
import { revalidatePath } from "next/cache";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/billing/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/billing/status", () => {
  it("clears invoice metadata when marking sessions unbilled", async () => {
    const res = await post({ sessionIds: ["page-a", "page-b"], status: "unbilled", invoiceNumber: "AFP-2026-003" });
    expect(res.status).toBe(200);
    expect(updateSessionBilling).toHaveBeenCalledWith(["page-a", "page-b"], "unbilled", "AFP-2026-003");
    expect(revalidatePath).toHaveBeenCalledWith("/api/notion/afp");
  });

  it("rejects invalid statuses without touching Notion", async () => {
    const res = await post({ sessionIds: ["page-a"], status: "reviewed" });
    expect(res.status).toBe(400);
    expect(updateSessionBilling).not.toHaveBeenCalled();
  });
});

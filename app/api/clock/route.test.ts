import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/notion", () => ({
  insertSession: vi.fn(async () => ({ id: "page_123" })),
  clearActiveClock: vi.fn(async () => {}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/clock/route";
import { insertSession, clearActiveClock } from "@/lib/notion";
import { revalidatePath } from "next/cache";

const good = {
  dateISO: "2026-07-16",
  sessionId: "AFP-2026-07-16-0903-1027",
  startDisplay: "9:03 AM",
  endDisplay: "10:27 AM",
  hours: 1.4,
  location: "Remote",
};
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/clock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/clock", () => {
  it("inserts a valid session, clears the running clock, and revalidates the read", async () => {
    const res = await post(good);
    expect(res.status).toBe(201);
    expect(insertSession).toHaveBeenCalledOnce();
    expect(clearActiveClock).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/api/notion/afp");
  });
  it("rejects a bad payload without touching Notion", async () => {
    const res = await post({ ...good, hours: 0 });
    expect(res.status).toBe(400);
    expect(insertSession).not.toHaveBeenCalled();
    expect(clearActiveClock).not.toHaveBeenCalled();
  });
  it("still saves the session when clearing the clock fails", async () => {
    (clearActiveClock as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("update denied")
    );
    const res = await post(good);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("page_123");
    expect(body.warning).toContain("could not be cleared");
  });
});

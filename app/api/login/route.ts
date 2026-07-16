import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, sign } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.APP_SECRET;
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  // 303, not the default 307. A 307 preserves the original method, so the browser
  // would re-request the redirect target with the same POST, and a GET-only page
  // route answers that with 405. Vercel's production edge network enforces this
  // strictly; local dev was lenient enough that this never surfaced there. 303
  // always forces GET on the follow-up request, which is the actual Post/Redirect/Get
  // pattern this route needs.
  if (!secret || password !== secret) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });
  }

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, await sign(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

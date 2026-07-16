import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, sign } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.APP_SECRET;
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  if (!secret || password !== secret) {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(COOKIE_NAME, await sign(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

// Gate every route behind a signed cookie, per docs/08-deploy.md. Not Auth.js, not
// Clerk: one user, and this is the size the job needs. The API route gets no
// exception; it fails 401 rather than redirecting, since a fetch() call has nowhere
// to redirect to.

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verify } from "@/lib/auth";

const OPEN_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  if (OPEN_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret = process.env.APP_SECRET;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (secret && (await verify(token, secret))) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

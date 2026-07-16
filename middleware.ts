// Gate every route behind a signed cookie, per docs/08-deploy.md. Not Auth.js, not
// Clerk: one user, and this is the size the job needs. The API route gets no
// exception; it fails 401 rather than redirecting, since a fetch() call has nowhere
// to redirect to.
//
// The polyfill below is not decoration. Production returned a 500 on every route,
// including /login, with "ReferenceError: __dirname is not defined". Documented,
// longstanding Next.js issue: next/server bundles a user-agent parser (ua-parser-js)
// that references __dirname, a real Node.js global next/server assumes exists. Local
// dev's Node-based simulation of the Edge runtime tolerates it; Vercel's real Edge
// isolate does not. This runs once at cold start, before any request is handled, so
// the polyfill is in place before that lazy code path can ever hit it.
if (typeof globalThis.__dirname === "undefined") {
  (globalThis as unknown as { __dirname: string }).__dirname = "/";
}

import { NextRequest, NextResponse } from "next/server";
// Relative import, not the "@/" alias. Vercel's edge-function bundler for middleware
// does not always resolve tsconfig path aliases, even though Next's own build does; a
// relative path sidesteps that deployment-only failure mode. Only matters here because
// middleware runs on the Edge runtime, which gets a separate bundling pass.
import { COOKIE_NAME, verify } from "./lib/auth";

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

// Gate every route behind a signed cookie, per docs/08-deploy.md. Not Auth.js, not
// Clerk: one user, and this is the size the job needs. The API route gets no
// exception; it fails 401 rather than redirecting, since a fetch() call has nowhere
// to redirect to.
//
// No import from "next/server", at all, on purpose. Production crashed on every
// route, including /login, with "ReferenceError: __dirname is not defined". Traced it
// to the actual stack trace on the upstream issue (vercel/next.js#53968): importing
// anything from next/server pulls in next's own user-agent helper, which pulls in a
// bundled ua-parser-js that references __dirname at that module's own top level, as a
// side effect of the import itself, before any code in this file ever runs. No
// polyfill placed in this file can fix that, since dependency modules evaluate before
// the importing module's own top-level statements do. Still open, still reproducing,
// since at least Next 13.4.2.
//
// Next's own middleware contract already permits a plain Response or undefined as the
// return value, not only NextResponse (see NextMiddlewareResult), so nothing here
// actually needs next/server. Cookies and the URL come off the standard Request
// object directly. lib/auth.ts itself never touches next/server either, only
// crypto.subtle, so importing it is unaffected by any of this.

import { COOKIE_NAME, verify } from "./lib/auth";

const OPEN_PATHS = ["/login", "/api/login"];

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export async function middleware(req: Request) {
  const url = new URL(req.url);

  if (OPEN_PATHS.some((p) => url.pathname.startsWith(p))) {
    return;
  }

  const secret = process.env.APP_SECRET;
  const token = getCookie(req, COOKIE_NAME);
  if (secret && (await verify(token, secret))) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  url.pathname = "/login";
  return Response.redirect(url.toString(), 307);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

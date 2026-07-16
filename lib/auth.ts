// Shared by middleware (Edge runtime) and the login route (Node runtime). Both expose
// crypto.subtle as a global, so this needs no Node-specific import and no Edge-specific
// workaround. See docs/08-deploy.md.

export const COOKIE_NAME = "afp_auth";

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The cookie value is HMAC(APP_SECRET, COOKIE_NAME), not the secret itself. A leaked
// cookie lets someone replay it, the same as any bearer token, but never reveals
// APP_SECRET, since HMAC does not invert.
export async function sign(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(COOKIE_NAME));
  return toHex(sig);
}

export async function verify(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  return token === (await sign(secret));
}

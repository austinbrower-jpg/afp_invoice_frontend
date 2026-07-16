// The single password form docs/08 calls for. A plain HTML form posting to
// /api/login, no client JS, so it works even without hydration.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="station">
      <main
        style={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
        }}
      >
        <form
          method="POST"
          action="/api/login"
          style={{ display: "grid", gap: 14, width: 260 }}
        >
          <div className="brand">
            <b>Invoice Builder</b>
          </div>
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            required
          />
          {error && (
            <p style={{ color: "var(--hot)", fontSize: 12 }}>Wrong password.</p>
          )}
          <button type="submit" className="print-btn">
            Enter
          </button>
        </form>
      </main>
    </div>
  );
}

// The single password form docs/08 calls for. A plain HTML form posting to /api/login, no
// client JS, so it works even without hydration. Styled as a Station card; the password
// field picks up the console's input treatment from globals.css.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="station">
      <main className="login-stage">
        <form method="POST" action="/api/login" className="login-card">
          <div className="brand">
            <b>AFP Invoice</b>
            <span>Battle Bound Branding</span>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter to continue"
              autoFocus
              required
            />
          </div>
          {error && <p className="login-err">Wrong password.</p>}
          <button type="submit" className="print-btn">
            Enter
          </button>
        </form>
      </main>
    </div>
  );
}

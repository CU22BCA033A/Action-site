"use client";

/** Last-resort page when the root layout itself fails. Plain HTML, English only. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#080c16", color: "#fff9e6", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "1rem" }}>
        <main>
          <h1 style={{ fontSize: "1.75rem" }}>The page did not load</h1>
          <p style={{ color: "#8f9bb6" }}>The server ran into a problem. Try again in a moment.</p>
          <p style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 1.25rem", background: "#ffbf00", color: "#0b1220", border: 0, borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
              Try again
            </button>
            {/* Plain link on purpose: the router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 1.25rem", border: "1px solid #3a4560", borderRadius: 6, color: "#fff9e6" }}>
              Go to the home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

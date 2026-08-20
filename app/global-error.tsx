"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          role="alert"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "0 1rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: 420, fontSize: "0.9rem", opacity: 0.75 }}>
            An unexpected error occurred while rendering this page.
            {error.digest ? ` (${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 12,
              border: "none",
              background: "#16804f",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
import { NextResponse, type NextRequest } from "next/server";

/**
 * Generates a fresh nonce per request and sets a strict Content Security
 * Policy. Inline scripts run only with this nonce.
 */
const REQUIRED = ["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "SESSION_SECRET", "CODE_PEPPER", "DATABASE_URL"] as const;

export function proxy(request: NextRequest) {
  // A fresh deployment without its settings goes to the setup helper instead of an error page.
  if (!request.nextUrl.pathname.startsWith("/setup") && REQUIRED.some((k) => !process.env[k])) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const host = request.nextUrl.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";

  let supabase: URL | null = null;
  try {
    supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
  } catch {
    // A malformed URL is reported by /api/health; pages still load.
  }
  const supabaseHttp = supabase ? `https://${supabase.host}` : "";
  const supabaseWs = supabase ? `wss://${supabase.host}` : "";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Development tooling injects styles without a nonce; production stays strict.
    isDev ? `style-src 'self' 'unsafe-inline'` : `style-src 'self' 'nonce-${nonce}'`,
    // Team colours and progress widths are set through style attributes.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabaseHttp}`.trim(),
    `font-src 'self'`,
    `connect-src 'self' ${supabaseHttp} ${supabaseWs}`.trim(),
    `media-src 'self'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev || isLocal ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|media|favicon.ico|icon|apple-icon|brand|licenses|screens|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

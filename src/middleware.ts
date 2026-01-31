import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Get the hostname from the request, handling various header formats
 */
function getHostname(request: NextRequest): string {
  // Check x-forwarded-host first (Vercel/proxy)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    return forwardedHost.split(",")[0]?.trim() ?? "";
  }

  // Fall back to host header
  const host = request.headers.get("host");
  if (host) {
    return host.split(":")[0] ?? ""; // Remove port if present
  }

  // Fall back to URL hostname
  return request.nextUrl.hostname;
}

/**
 * Check if the request is for the marketing domain
 */
function isMarketingDomain(hostname: string): boolean {
  return hostname === "complyvault.co" || hostname.endsWith(".complyvault.co");
}

/**
 * Check if the request is for the app domain
 */
function isAppDomain(hostname: string): boolean {
  return hostname === "app.complyvault.co" || hostname.endsWith(".app.complyvault.co");
}

export async function middleware(request: NextRequest) {
  const hostname = getHostname(request);
  const pathname = request.nextUrl.pathname;

  // Marketing domain (complyvault.co) - public access
  if (isMarketingDomain(hostname) && !isAppDomain(hostname)) {
    // Allow all marketing pages and trial request endpoints
    // Public routes: /, /uk, /api/trial/request, etc.
    const marketingPublicRoutes = [
      "/",
      "/uk",
      "/api/trial",
      "/api/auth", // Auth endpoints for marketing site
    ];

    const isMarketingPublicRoute = marketingPublicRoutes.some((route) =>
      pathname.startsWith(route)
    );

    if (isMarketingPublicRoute) {
      return NextResponse.next();
    }

    // For marketing domain, allow all other routes (they're public pages)
    return NextResponse.next();
  }

  // App domain (app.complyvault.co) - protected access
  if (isAppDomain(hostname)) {
    // Public allowlist for app domain
    const appPublicRoutes = [
      "/auth", // Auth pages (signin, signup)
      "/api/auth", // Auth.js endpoints
      "/api/billing/webhook", // Stripe webhook
      "/api/health", // Health check (if exists)
      "/invitations", // Invitation acceptance pages
      "/billing", // Billing pages (upgrade flow)
      "/api/billing/checkout", // Billing checkout (uses requireAuthAndEmailVerified)
      "/api/billing/status", // Billing status (uses requireAuthAndEmailVerified)
    ];

    const isAppPublicRoute = appPublicRoutes.some((route) =>
      pathname.startsWith(route)
    );

    if (isAppPublicRoute) {
      return NextResponse.next();
    }

    // For API routes, don't redirect - let them return JSON errors
    // This allows API routes to return 401/403/402 JSON responses
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // For protected app pages (non-API), check authentication and redirect for UX
    // Note: This is for UX (redirects), NOT security
    // Security is enforced by requireAppAccess() guard in API routes
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      const signInUrl = new URL("/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Token exists - let it through
    // Full access control (email verification, workspace, entitlements) is done in requireAppAccess()
    return NextResponse.next();
  }

  // Default: allow through (for localhost, other domains, etc.)
  // In production, you may want to redirect unknown domains
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


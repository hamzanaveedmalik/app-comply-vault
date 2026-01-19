import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Use getToken instead of auth() to avoid importing Prisma in Edge runtime
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/api/auth",
    "/auth",
    "/invitations",
    "/api/jobs",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protect all other routes
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check if user has a workspace (for app routes)
  // Exclude workspace creation page from this check
  // Note: workspaceId check is done in layout/page components since we can't access DB in middleware
  const isWorkspaceCreationPage = request.nextUrl.pathname === "/workspaces/new";
  const appRoutes = ["/dashboard", "/workspaces", "/meetings", "/upload", "/settings"];
  const isAppRoute = appRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Workspace check is handled in layout components (can't access DB in Edge runtime)
  // Middleware only checks authentication, not workspace membership

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


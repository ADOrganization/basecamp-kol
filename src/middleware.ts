import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // XSS protection (legacy but still useful)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy - don't leak URLs to other sites
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy - disable unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // HSTS - enforce HTTPS (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

// Admin portal protected routes (previously under /agency)
const ADMIN_PROTECTED_ROUTES = [
  "/dashboard",
  "/kols",
  "/campaigns",
  "/content",
  "/clients",
  "/telegram",
  "/settings",
  "/payments",
];

// Check if path is an admin protected route
function isAdminProtectedRoute(pathname: string): boolean {
  return ADMIN_PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

// Handle admin subdomain separately (no NextAuth)
function handleAdminSubdomain(req: NextRequest): NextResponse {
  const { nextUrl } = req;

  // Check for admin_token cookie to determine if logged in
  const adminToken = req.cookies.get("admin_token")?.value;
  const isLoggedIn = !!adminToken;

  // API routes - allow (they handle their own auth)
  if (nextUrl.pathname.startsWith("/api")) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Static assets - allow
  if (nextUrl.pathname.startsWith("/_next") || nextUrl.pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Block client portal routes on admin subdomain - redirect to dashboard (if logged in) or login
  // Note: Use "/client/" to avoid matching "/clients" (admin clients page)
  if (nextUrl.pathname.startsWith("/client/") || nextUrl.pathname === "/client") {
    const url = nextUrl.clone();
    url.pathname = isLoggedIn ? "/dashboard" : "/";
    return NextResponse.redirect(url);
  }

  // If logged in, redirect root/login to dashboard
  if (isLoggedIn && (nextUrl.pathname === "/" || nextUrl.pathname === "/login" || nextUrl.pathname === "/admin/login")) {
    const url = nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // If not logged in, serve login page at root (rewrite, no redirect)
  if (!isLoggedIn && (nextUrl.pathname === "/" || nextUrl.pathname === "/login")) {
    const url = nextUrl.clone();
    url.pathname = "/admin/login";
    const response = NextResponse.rewrite(url);
    return addSecurityHeaders(response);
  }

  // Admin login/setup pages - allow access (no redirect needed)
  if (nextUrl.pathname.startsWith("/admin")) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Protected admin routes - require admin auth
  if (isAdminProtectedRoute(nextUrl.pathname)) {
    if (!isLoggedIn) {
      // Redirect to root (which shows login) - clean URL
      const url = nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // All other paths - apply security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

// NextAuth wrapped middleware for main site
const authMiddleware = auth((req) => {
  try {
    const { nextUrl, auth: session } = req;
    const isLoggedIn = !!session?.user;

    // Route classification
    const isAuthPage =
      nextUrl.pathname.startsWith("/login") ||
      nextUrl.pathname.startsWith("/register") ||
      nextUrl.pathname.startsWith("/verify-request") ||
      nextUrl.pathname.startsWith("/auth-error") ||
      nextUrl.pathname.startsWith("/accept-invite") ||
      nextUrl.pathname.startsWith("/setup-2fa") ||
      nextUrl.pathname.startsWith("/verify-2fa");

    // Note: Use "/client/" to avoid matching "/clients" (admin clients page)
    const isClientRoute = nextUrl.pathname.startsWith("/client/") || nextUrl.pathname === "/client";
    const isAdminRoute = nextUrl.pathname.startsWith("/admin");
    const isAdminPortalRoute = isAdminProtectedRoute(nextUrl.pathname);

    const isApiRoute = nextUrl.pathname.startsWith("/api");

    const isPublicRoute =
      nextUrl.pathname === "/" ||
      nextUrl.pathname.startsWith("/_next") ||
      nextUrl.pathname === "/favicon.ico";

    // API routes handle their own auth and security
    if (isApiRoute) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Allow public routes with security headers
    if (isPublicRoute && !isAdminPortalRoute && !isClientRoute) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Admin routes have their own auth system (not NextAuth)
    if (isAdminRoute) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Allow auth pages with security headers
    if (isAuthPage && !isAdminPortalRoute && !isClientRoute) {
      // If already logged in, redirect to dashboard
      if (isLoggedIn && session?.user?.organizationType) {
        const redirectTo =
          session.user.organizationType === "AGENCY"
            ? "/dashboard"
            : "/client/dashboard";
        return NextResponse.redirect(new URL(redirectTo, nextUrl));
      }
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Redirect non-logged-in users to login
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // Check organization type for protected routes
    if (isLoggedIn && session?.user) {
      const userOrgType = session.user.organizationType;

      // Agency users trying to access client routes
      if (isClientRoute && userOrgType === "AGENCY") {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }

      // Client users trying to access admin portal routes
      if (isAdminPortalRoute && userOrgType === "CLIENT") {
        return NextResponse.redirect(new URL("/client/dashboard", nextUrl));
      }
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Middleware error:", error);
    return new NextResponse("Internal Server Error", {
      status: 500,
      headers: {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
      }
    });
  }
});

// Handle client domain (main domain - no admin/agency access)
function handleClientDomain(req: NextRequest): NextResponse | null {
  const { nextUrl } = req;

  // Block admin and admin portal routes on client domain
  if (nextUrl.pathname.startsWith("/admin") || isAdminProtectedRoute(nextUrl.pathname)) {
    // Redirect to client dashboard or login
    const url = nextUrl.clone();
    url.pathname = "/client/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect root to client dashboard
  if (nextUrl.pathname === "/") {
    const url = nextUrl.clone();
    url.pathname = "/client/dashboard";
    return NextResponse.redirect(url);
  }

  // Let auth middleware handle the rest
  return null;
}

// Main middleware - routes to appropriate handler based on hostname
export default function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";

  // Handle admin subdomain separately (no NextAuth involvement)
  if (hostname.startsWith("admin.")) {
    return handleAdminSubdomain(req);
  }

  // Handle client domain (basecampnetwork.xyz) - block admin routes
  if (hostname.includes("basecampnetwork.xyz") && !hostname.startsWith("admin.")) {
    const clientRedirect = handleClientDomain(req);
    if (clientRedirect) return clientRedirect;
  }

  // For all other domains, use NextAuth middleware
  return authMiddleware(req, {} as any);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/healthcheck).*)"],
};

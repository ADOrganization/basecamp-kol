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
  // SECURITY: Removed 'unsafe-eval' - only allow 'unsafe-inline' for Next.js hydration
  // In production, consider using nonces for better security
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com", // Removed unsafe-eval
    "style-src 'self' 'unsafe-inline'", // Required for styled components / Tailwind
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:", // Allow WebSocket for dev tools
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests", // Force HTTPS for all resources
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

// Handle admin subdomain separately (no NextAuth)
function handleAdminSubdomain(req: NextRequest): NextResponse {
  const { nextUrl } = req;

  // Check for admin_token cookie to determine if logged in
  const adminToken = req.cookies.get("admin_token")?.value;
  const isLoggedIn = !!adminToken;

  // Auth pages - rewrite to admin login
  if (nextUrl.pathname === "/" || nextUrl.pathname === "/login") {
    // If logged in, redirect to dashboard
    if (isLoggedIn) {
      const url = nextUrl.clone();
      url.pathname = "/agency/dashboard";
      return NextResponse.redirect(url);
    }
    const url = nextUrl.clone();
    url.pathname = "/admin/login";
    const response = NextResponse.rewrite(url);
    return addSecurityHeaders(response);
  }

  // Admin login page - allow access
  if (nextUrl.pathname === "/admin/login" || nextUrl.pathname === "/admin") {
    // If already logged in, redirect to dashboard
    if (isLoggedIn) {
      const url = nextUrl.clone();
      url.pathname = "/agency/dashboard";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Block client routes on admin subdomain
  if (nextUrl.pathname.startsWith("/client")) {
    const url = nextUrl.clone();
    url.pathname = "/agency/dashboard";
    return NextResponse.redirect(url);
  }

  // Protected agency routes - require admin auth
  if (nextUrl.pathname.startsWith("/agency")) {
    if (!isLoggedIn) {
      const url = nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // API routes - allow (they handle their own auth)
  if (nextUrl.pathname.startsWith("/api")) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // All other paths on admin subdomain
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

    const isAgencyRoute = nextUrl.pathname.startsWith("/agency");
    const isClientRoute = nextUrl.pathname.startsWith("/client");
    const isAdminRoute = nextUrl.pathname.startsWith("/admin");

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
    if (isPublicRoute && !isAgencyRoute && !isClientRoute) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Admin routes have their own auth system (not NextAuth)
    // Allow all admin routes to pass through - they handle their own auth
    if (isAdminRoute) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Allow auth pages (login, verify-request, auth-error, accept-invite) with security headers
    if (isAuthPage && !isAgencyRoute && !isClientRoute) {
      // If already logged in, redirect to dashboard
      if (isLoggedIn && session?.user?.organizationType) {
        const redirectTo =
          session.user.organizationType === "AGENCY"
            ? "/agency/dashboard"
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
        return NextResponse.redirect(new URL("/agency/dashboard", nextUrl));
      }

      // Client users trying to access agency routes
      if (isAgencyRoute && userOrgType === "CLIENT") {
        return NextResponse.redirect(new URL("/client/dashboard", nextUrl));
      }
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Middleware error:", error);
    // SECURITY: On error, deny access instead of allowing through
    // This prevents potential bypass attacks
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

  // Block admin and agency routes on client domain
  if (nextUrl.pathname.startsWith("/admin") || nextUrl.pathname.startsWith("/agency")) {
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

  // Handle client domain (basecampnetwork.xyz) - block admin/agency routes
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

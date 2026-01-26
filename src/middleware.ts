import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
    "style-src 'self' 'unsafe-inline'", // Required for styled components
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export default auth((req) => {
  try {
    const { nextUrl, auth: session } = req;
    const isLoggedIn = !!session?.user;
    const hostname = req.headers.get("host") || "";

    // Handle admin subdomain - rewrite to /admin routes
    if (hostname.startsWith("admin.")) {
      // If not already on /admin route, rewrite to /admin equivalent
      if (!nextUrl.pathname.startsWith("/admin") && !nextUrl.pathname.startsWith("/api/admin")) {
        // Rewrite root or /login to /admin/login
        if (nextUrl.pathname === "/" || nextUrl.pathname === "/login") {
          const url = nextUrl.clone();
          url.pathname = "/admin/login";
          return NextResponse.rewrite(url);
        }
        // For other paths, rewrite to /admin prefix
        const url = nextUrl.clone();
        url.pathname = `/admin${nextUrl.pathname}`;
        return NextResponse.rewrite(url);
      }
    }

    // Route classification
    const isAuthPage =
      nextUrl.pathname.startsWith("/login") ||
      nextUrl.pathname.startsWith("/register") ||
      nextUrl.pathname.startsWith("/verify-request") ||
      nextUrl.pathname.startsWith("/auth-error") ||
      nextUrl.pathname.startsWith("/accept-invite");

    const isAgencyRoute = nextUrl.pathname.startsWith("/agency");
    const isClientRoute = nextUrl.pathname.startsWith("/client");
    const isKolRoute = nextUrl.pathname.startsWith("/kol");
    const isAdminRoute = nextUrl.pathname.startsWith("/admin");

    const isKolAuthPage =
      nextUrl.pathname.startsWith("/kol/login") ||
      nextUrl.pathname.startsWith("/kol/accept-invite");

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
    if (isPublicRoute && !isAgencyRoute && !isClientRoute && !isKolRoute) {
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
    if (isAuthPage && !isAgencyRoute && !isClientRoute && !isKolRoute) {
      // If already logged in, redirect to dashboard
      if (isLoggedIn && session?.user?.organizationType) {
        if (session.user.isKol) {
          return NextResponse.redirect(new URL("/kol/dashboard", nextUrl));
        }
        const redirectTo =
          session.user.organizationType === "AGENCY"
            ? "/agency/dashboard"
            : "/client/dashboard";
        return NextResponse.redirect(new URL(redirectTo, nextUrl));
      }
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // Allow KOL auth pages (login, accept-invite) without authentication
    if (isKolAuthPage) {
      // If KOL is already logged in, redirect to dashboard
      if (isLoggedIn && session?.user?.isKol) {
        return NextResponse.redirect(new URL("/kol/dashboard", nextUrl));
      }
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }

    // KOL route protection
    if (isKolRoute && !isKolAuthPage) {
      if (!isLoggedIn || !session?.user?.isKol) {
        return NextResponse.redirect(new URL("/kol/login", nextUrl));
      }
    }

    // Redirect non-logged-in users to appropriate login
    if (!isLoggedIn && !isKolRoute) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // Check organization type for protected routes
    if (isLoggedIn && session?.user) {
      const userOrgType = session.user.organizationType;
      const isKol = session.user.isKol;

      // Prevent KOLs from accessing agency/client routes
      if (isKol && (isAgencyRoute || isClientRoute)) {
        return NextResponse.redirect(new URL("/kol/dashboard", nextUrl));
      }

      // Prevent agency/client users from accessing KOL routes
      if (!isKol && isKolRoute && !isKolAuthPage) {
        const redirectTo =
          userOrgType === "AGENCY" ? "/agency/dashboard" : "/client/dashboard";
        return NextResponse.redirect(new URL(redirectTo, nextUrl));
      }

      // Agency users trying to access client routes
      if (!isKol && isClientRoute && userOrgType === "AGENCY") {
        return NextResponse.redirect(new URL("/agency/dashboard", nextUrl));
      }

      // Client users trying to access agency routes
      if (!isKol && isAgencyRoute && userOrgType === "CLIENT") {
        return NextResponse.redirect(new URL("/client/dashboard", nextUrl));
      }
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, allow the request through with security headers
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/healthcheck).*)"],
};

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  try {
    const { nextUrl, auth: session } = req;
    const isLoggedIn = !!session?.user;
    const isAuthPage = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
    const isAgencyRoute = nextUrl.pathname.startsWith("/agency");
    const isClientRoute = nextUrl.pathname.startsWith("/client");
    const isKolRoute = nextUrl.pathname.startsWith("/kol");
    const isKolAuthPage = nextUrl.pathname.startsWith("/kol/login") ||
                          nextUrl.pathname.startsWith("/kol/accept-invite");
    const isApiRoute = nextUrl.pathname.startsWith("/api");
    const isPublicRoute = nextUrl.pathname === "/" || nextUrl.pathname.startsWith("/_next");

    // Allow API routes to handle their own auth
    if (isApiRoute) {
      return NextResponse.next();
    }

    // Allow public routes
    if (isPublicRoute && !isAgencyRoute && !isClientRoute && !isKolRoute) {
      return NextResponse.next();
    }

    // Allow KOL auth pages (login, accept-invite) without authentication
    if (isKolAuthPage) {
      // If KOL is already logged in, redirect to dashboard
      if (isLoggedIn && session?.user?.isKol) {
        return NextResponse.redirect(new URL("/kol/dashboard", nextUrl));
      }
      return NextResponse.next();
    }

    // Redirect logged-in users away from agency/client auth pages
    if (isAuthPage && isLoggedIn && session?.user?.organizationType) {
      if (session.user.isKol) {
        return NextResponse.redirect(new URL("/kol/dashboard", nextUrl));
      }
      const redirectTo = session.user.organizationType === "AGENCY" ? "/agency/dashboard" : "/client/dashboard";
      return NextResponse.redirect(new URL(redirectTo, nextUrl));
    }

    // KOL route protection
    if (isKolRoute && !isKolAuthPage) {
      if (!isLoggedIn || !session?.user?.isKol) {
        return NextResponse.redirect(new URL("/kol/login", nextUrl));
      }
    }

    // Redirect non-logged-in users to appropriate login
    if (!isLoggedIn && !isAuthPage && !isKolRoute) {
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
        const redirectTo = userOrgType === "AGENCY" ? "/agency/dashboard" : "/client/dashboard";
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

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, allow the request through - pages will handle auth
    return NextResponse.next();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/healthcheck).*)"],
};

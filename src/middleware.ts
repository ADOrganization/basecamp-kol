import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const isAuthPage = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isAgencyRoute = nextUrl.pathname.startsWith("/agency");
  const isClientRoute = nextUrl.pathname.startsWith("/client");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isPublicRoute = nextUrl.pathname === "/" || nextUrl.pathname.startsWith("/_next");

  // Allow API routes to handle their own auth
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute && !isAgencyRoute && !isClientRoute) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    const redirectTo = session.user.organizationType === "AGENCY" ? "/agency/dashboard" : "/client/dashboard";
    return NextResponse.redirect(new URL(redirectTo, nextUrl));
  }

  // Redirect non-logged-in users to login
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Check organization type for protected routes
  if (isLoggedIn && session.user) {
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

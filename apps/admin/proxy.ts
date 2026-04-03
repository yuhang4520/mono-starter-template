import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const headerValues = await headers();

  const session = await auth.api.getSession({
    headers: headerValues,
  });

  // THIS IS NOT SECURE!
  // This is the recommended approach to optimistically redirect users
  // We recommend handling auth checks in each page/route
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.user.role === "user" && !session.session.activeOrganizationId) {
    const tenants = await auth.api.listOrganizations({
      headers: headerValues,
    });

    if (tenants.length) {
      await auth.api.setActiveOrganization({
        headers: headerValues,
        body: {
          organizationId: tenants[0].id,
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude API routes, static files, image optimizations, and login/signup pages
    "/((?!api|_next|_next/static|_next/image|favicon.ico|login|signup).*)",
  ],
};

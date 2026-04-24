import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Write-freeze guard — flip READ_ONLY=true during DB migrations to return 503
  // on all mutating requests while read traffic continues to flow. Cron routes
  // are excluded so scheduled sync jobs keep running.
  if (
    process.env.READ_ONLY === "true" &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !request.nextUrl.pathname.startsWith("/api/sync/cron")
  ) {
    return NextResponse.json(
      {
        error: "maintenance_write_freeze",
        message:
          "System is temporarily in read-only mode during database migration. Please try again in a few minutes.",
      },
      { status: 503, headers: { "Retry-After": "120" } }
    );
  }

  const response = await updateSession(request);

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

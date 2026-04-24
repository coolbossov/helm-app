import { NextRequest, NextResponse } from 'next/server';

// Dormant guard — activated by setting READ_ONLY=true env var during DB migration cutover. Cron path is excluded from the matcher.
export function middleware(request: NextRequest) {
  if (process.env.READ_ONLY === 'true' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.json(
      {
        error: 'maintenance_write_freeze',
        message: 'System is temporarily in read-only mode during database migration. Please try again in a few minutes.',
      },
      { status: 503, headers: { 'Retry-After': '120' } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|api/sync/cron).*)'],
};

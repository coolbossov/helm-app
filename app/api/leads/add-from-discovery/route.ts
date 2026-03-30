// DEPRECATED — returns 410 Gone.
// Use POST /api/leads/batch-add instead (writes to synced_companies, not synced_contacts).
// This endpoint will be deleted in a future cleanup pass.

import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use POST /api/leads/batch-add instead." },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use POST /api/leads/batch-add instead." },
    { status: 410 }
  );
}

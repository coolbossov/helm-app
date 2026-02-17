import { NextRequest, NextResponse } from "next/server";
import { processFieldUpdates } from "@/lib/zoho/push-processor";
import { processPendingActivitySync } from "@/lib/zoho/notes-sync";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [fieldResult, activityResult] = await Promise.all([
    processFieldUpdates(),
    processPendingActivitySync(),
  ]);

  const summary = {
    ran_at: new Date().toISOString(),
    fields_processed: fieldResult.processed,
    fields_failed: fieldResult.failed,
    activities_synced: activityResult.synced,
    activities_failed: activityResult.failed,
  };

  console.log("[cron/push]", summary);

  return NextResponse.json(summary);
}

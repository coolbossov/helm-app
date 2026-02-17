import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { processFieldUpdates } from "@/lib/zoho/push-processor";
import { processPendingActivitySync } from "@/lib/zoho/notes-sync";

export async function POST() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit("push-sync", 1, 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Push sync rate limited. Try again in 1 minute." },
      { status: 429 }
    );
  }

  const [fieldResult, activityResult] = await Promise.all([
    processFieldUpdates(),
    processPendingActivitySync(),
  ]);

  return NextResponse.json({
    success: true,
    fields_processed: fieldResult.processed,
    fields_failed: fieldResult.failed,
    activities_synced: activityResult.synced,
    activities_failed: activityResult.failed,
  });
}

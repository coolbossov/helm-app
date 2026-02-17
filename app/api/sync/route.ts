import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncAllContacts } from "@/lib/zoho/contacts";
import { batchGeocodeContacts } from "@/lib/google/geocoder";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST() {
  // Require authentication
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 1 sync per 5 minutes
  const { success } = rateLimit("sync", 1, 5 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Sync already in progress or rate limited. Try again in 5 minutes." },
      { status: 429 }
    );
  }

  const supabase = createAdminClient();

  // Create sync log entry
  const { data: log } = await supabase
    .from("sync_logs")
    .insert({ status: "running" })
    .select()
    .single();

  try {
    // Step 1: Sync contacts from Zoho
    const syncResult = await syncAllContacts();

    // Step 2: Geocode new contacts
    const geocoded = await batchGeocodeContacts();

    // Update sync log
    await supabase
      .from("sync_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        contacts_synced: syncResult.synced,
        contacts_created: syncResult.created,
        contacts_updated: syncResult.updated,
        contacts_geocoded: geocoded,
      })
      .eq("id", log!.id);

    return NextResponse.json({
      success: true,
      contacts_synced: syncResult.synced,
      contacts_geocoded: geocoded,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Update sync log with error
    if (log) {
      await supabase
        .from("sync_logs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", log.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

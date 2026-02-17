// POST /api/contacts/manual
// Creates manual (non-CRM) contact entries for bulk import.
// Geocodes each address and upserts into synced_contacts with zoho_id = "manual_<uuid>".

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/google/geocoder";

const schema = z.object({
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
  })).min(1).max(100),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: Array<{
    name: string;
    address: string;
    contact: { id: string; last_name: string; account_name: string | null; latitude: number; longitude: number; business_type: string[]; priority: null; lifecycle_stage: null; contacting_status: null; zoho_id: string } | null;
    error?: string;
  }> = [];

  for (const item of parsed.data.items) {
    try {
      const geo = await geocodeAddress(item.address);
      if (geo.status !== "OK" || !geo.latitude || !geo.longitude) {
        throw new Error("Could not geocode address — try a more specific address");
      }
      const zohoId = `manual_${crypto.randomUUID()}`;

      // Parse name: treat the whole string as account_name, last word as last_name
      const nameParts = item.name.trim().split(/\s+/);
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];
      const firstName = nameParts.length > 1 ? nameParts[0] : null;

      const { data: contact, error: insertError } = await admin
        .from("synced_contacts")
        .insert({
          zoho_id: zohoId,
          last_name: lastName,
          first_name: firstName,
          account_name: item.name,
          mailing_street: item.address,
          latitude: geo.latitude,
          longitude: geo.longitude,
          geocode_status: "success",
          business_type: [],
          last_synced_at: new Date().toISOString(),
        })
        .select("id, last_name, account_name, latitude, longitude, business_type, priority, lifecycle_stage, contacting_status, zoho_id")
        .single();

      if (insertError) throw new Error(insertError.message);

      results.push({ name: item.name, address: item.address, contact });
    } catch (e) {
      results.push({
        name: item.name,
        address: item.address,
        contact: null,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  return NextResponse.json({ data: results });
}

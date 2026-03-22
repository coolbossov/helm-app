// POST /api/leads/add-from-discovery
// Inserts a Google Places result into synced_contacts.
// lat/lng are already known from the discovery step — no geocoding needed.
// Sets visit_status = "Never Visited" and lifecycle_stage = "Lead".
// Uses place_id for upsert deduplication.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  place_id: z.string().min(1),
  name: z.string().min(1).max(200),
  address: z.string().max(500).default(""),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().max(50).nullable().default(null),
  website: z.string().url().max(500).nullable().default(null),
  business_type: z.array(z.string()).default([]),
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

  const {
    place_id,
    name,
    address,
    lat,
    lng,
    phone,
    website,
    business_type,
  } = parsed.data;

  const admin = createAdminClient();

  // Check for duplicate by place_id
  const { data: existing } = await admin
    .from("synced_contacts")
    .select("id, account_name")
    .eq("place_id", place_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Already in CRM", existing_id: existing.id },
      { status: 409 }
    );
  }

  // Parse name: treat whole string as account_name, last word(s) as last_name
  const nameParts = name.trim().split(/\s+/);
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0];
  const firstName = nameParts.length > 1 ? nameParts[0] : null;

  // zoho_id for manually-added places — prefixed so sync never tries to push them
  const zohoId = `place_${place_id}`;

  const { data: contact, error: insertError } = await admin
    .from("synced_contacts")
    .insert({
      zoho_id: zohoId,
      place_id,
      last_name: lastName,
      first_name: firstName,
      account_name: name,
      mailing_street: address,
      phone: phone ?? null,
      website: website ?? null,
      latitude: lat,
      longitude: lng,
      geocode_status: "success",
      business_type: business_type.length > 0 ? business_type : [],
      lifecycle_stage: "Lead",
      visit_status: "Never Visited",
      last_synced_at: new Date().toISOString(),
    })
    .select(
      "id, zoho_id, last_name, account_name, latitude, longitude, business_type, priority, lifecycle_stage, contacting_status, visit_status"
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ data: contact }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  leads: z.array(
    z.object({
      // Google Place IDs are alphanumeric+underscores, max ~200 chars — enforce allowlist
      place_id: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/, "Invalid place_id format"),
      name: z.string().trim().min(1).max(200),
      address: z.string().max(500).default(""),
      lat: z.number(),
      lng: z.number(),
      phone: z.string().max(50).nullable().default(null),
      // Only allow http/https URLs — rejects javascript:, file:, data: etc.
      website: z.string().url().max(500).startsWith("http").nullable().default(null),
    })
  ).min(1).max(100),
  // Accepts either a single string (new) or array (legacy) for backward compat
  business_type: z.union([z.string(), z.array(z.string())]).default(""),
});

interface CreatedContact {
  id: string;
  zoho_id: string;
  last_name: string;
  account_name: string | null;
  latitude: number;
  longitude: number;
  business_type: string[];
  priority: string | null;
  lifecycle_stage: string | null;
  contacting_status: string | null;
  visit_status: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { leads } = parsed.data;
  // Normalize business_type to a single string for synced_companies
  const rawType = parsed.data.business_type;
  const business_type: string | null = Array.isArray(rawType)
    ? (rawType[0] ?? null)
    : rawType
      ? rawType
      : null;

  let added = 0;
  let skipped = 0;
  let failed = 0;
  const contacts: CreatedContact[] = [];
  const chunkSize = 25;

  for (let i = 0; i < leads.length; i += chunkSize) {
    const chunk = leads.slice(i, i + chunkSize);
    const rows = chunk.map((lead) => {
      const normalizedName = lead.name.trim();

      return {
        zoho_account_id: `place_${lead.place_id}`,
        place_id: lead.place_id,
        company_name: normalizedName,
        billing_street: lead.address,
        phone: lead.phone ?? null,
        website: lead.website ?? null,
        latitude: lead.lat,
        longitude: lead.lng,
        geocode_status: "success",
        business_type,
        lifecycle_stage: "Lead",
        visit_status: "Never Visited",
        last_synced_at: new Date().toISOString(),
      };
    });

    const { data: upserted, error: upsertError } = await admin
      .from("synced_companies")
      .upsert(
        rows,
        { onConflict: "place_id", ignoreDuplicates: true }
      )
      .select(
        "id, zoho_account_id, company_name, latitude, longitude, business_type, priority, lifecycle_stage, contacting_status, visit_status"
      );

    if (upsertError) {
      failed += chunk.length;
      continue;
    }

    const inserted = (upserted ?? []).map((row) => ({
      id: row.id,
      zoho_id: row.zoho_account_id,
      last_name: row.company_name,
      account_name: row.company_name,
      latitude: row.latitude,
      longitude: row.longitude,
      business_type: row.business_type ? [row.business_type] : [],
      priority: row.priority,
      lifecycle_stage: row.lifecycle_stage,
      contacting_status: row.contacting_status,
      visit_status: row.visit_status,
    })) as CreatedContact[];
    contacts.push(...inserted);
    added += inserted.length;
    skipped += chunk.length - inserted.length;
  }

  const status = failed > 0 ? 207 : 201;
  return NextResponse.json({ added, skipped, failed, contacts }, { status });
}

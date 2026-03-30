import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;

  // Build query
  let query = supabase.from("synced_companies").select(
    `id, zoho_account_id, company_name, phone,
     latitude, longitude, business_type, priority,
     lifecycle_stage, contacting_status,
     visit_status, last_visit_date`
  );

  // Filters
  const businessTypes = searchParams.get("business_types");
  if (businessTypes) {
    const types = businessTypes.split(",");
    query = query.in("business_type", types);
  }

  const priority = searchParams.get("priority");
  if (priority) {
    query = query.in("priority", priority.split(","));
  }

  const lifecycle = searchParams.get("lifecycle_stage");
  if (lifecycle) {
    query = query.in("lifecycle_stage", lifecycle.split(","));
  }

  const status = searchParams.get("contacting_status");
  if (status) {
    query = query.in("contacting_status", status.split(","));
  }

  const visitStatus = searchParams.get("visit_status");
  if (visitStatus) {
    query = query.in("visit_status", visitStatus.split(","));
  }

  // Filter by overdue: not visited in X days
  const overdueDays = searchParams.get("overdue_days");
  if (overdueDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(overdueDays, 10));
    query = query.or(
      `last_visit_date.is.null,last_visit_date.lte.${cutoff.toISOString().split("T")[0]}`
    );
  }

  const search = searchParams.get("search");
  if (search) {
    // Strip PostgREST filter syntax characters to prevent filter injection
    const safeSearch = search.replace(/[(),]/g, "").slice(0, 100);
    query = query.or(
      `company_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`
    );
  }

  // Only include geocoded contacts for map display
  const mapOnly = searchParams.get("map") === "true";
  if (mapOnly) {
    query = query
      .not("latitude", "is", null)
      .not("longitude", "is", null);
  }

  // Viewport bounds filtering
  const north = searchParams.get("north");
  const south = searchParams.get("south");
  const east = searchParams.get("east");
  const west = searchParams.get("west");
  if (north && south && east && west) {
    query = query
      .gte("latitude", parseFloat(south))
      .lte("latitude", parseFloat(north))
      .gte("longitude", parseFloat(west))
      .lte("longitude", parseFloat(east));
  }

  query = query.order("company_name", { ascending: true }).limit(10000);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data ?? []).map((row) => ({
    id: row.id,
    zoho_id: row.zoho_account_id,
    last_name: row.company_name,
    first_name: null,
    account_name: row.company_name,
    latitude: row.latitude,
    longitude: row.longitude,
    business_type: row.business_type ? [row.business_type] : [],
    priority: row.priority,
    lifecycle_stage: row.lifecycle_stage,
    contacting_status: row.contacting_status,
    visit_status: row.visit_status,
    last_visit_date: row.last_visit_date,
  }));

  return NextResponse.json(
    { data: normalized, count: normalized.length },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}

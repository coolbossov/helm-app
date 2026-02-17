import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;

  // Build query
  let query = supabase.from("synced_contacts").select(
    `id, zoho_id, last_name, first_name, account_name,
     latitude, longitude, business_type, priority,
     lifecycle_stage, contacting_status`
  );

  // Filters
  const businessTypes = searchParams.get("business_types");
  if (businessTypes) {
    const types = businessTypes.split(",");
    query = query.overlaps("business_type", types);
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

  const search = searchParams.get("search");
  if (search) {
    // Strip PostgREST filter syntax characters to prevent filter injection
    const safeSearch = search.replace(/[(),]/g, "").slice(0, 100);
    query = query.or(
      `last_name.ilike.%${safeSearch}%,account_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
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

  query = query.order("last_name", { ascending: true }).limit(10000);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count: data?.length ?? 0 });
}

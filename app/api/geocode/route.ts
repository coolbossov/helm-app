import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress, batchGeocodeContacts, batchGeocodeCompanies } from "@/lib/google/geocoder";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  address: z.string().min(1, "Address is required"),
});

export async function POST(request: NextRequest) {
  // Auth check must come first — before parsing body — to prevent unauthenticated API key usage
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const target = request.nextUrl.searchParams.get("target") === "companies"
    ? "companies"
    : "contacts";

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!body || (typeof body === "object" && body !== null && !("address" in body))) {
    try {
      const geocoded = target === "companies"
        ? await batchGeocodeCompanies()
        : await batchGeocodeContacts();
      return NextResponse.json({ success: true, target, geocoded });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch geocode failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  try {
    const result = await geocodeAddress(parsed.data.address);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = request.nextUrl.searchParams.get("target") === "companies"
    ? "companies"
    : "contacts";

  try {
    const geocoded = target === "companies"
      ? await batchGeocodeCompanies()
      : await batchGeocodeContacts();

    return NextResponse.json({ success: true, target, geocoded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch geocode failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

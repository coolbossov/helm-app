// POST /api/leads/discover
// Calls Google Places Nearby Search API server-side.
// Returns up to 20 nearby places matching the given type and radius.
// Center is a lat/lng, radius in meters.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(500).max(50000), // meters
  keyword: z.string().min(1).max(100),
});

export interface DiscoveryResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  user_ratings_total: number | null;
  phone: string | null;
  website: string | null;
  types: string[];
  // true if already in synced_contacts
  already_in_crm: boolean;
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  types?: string[];
}

interface GooglePlacesNearbyResponse {
  status: string;
  results?: GooglePlaceResult[];
  error_message?: string;
}

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

  const { lat, lng, radius, keyword } = parsed.data;
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  // Fetch all pages (up to 60 results via 3 pages of 20)
  const allResults: GooglePlaceResult[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < 3; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("key", apiKey);
    if (pageToken) {
      url.searchParams.set("pagetoken", pageToken);
      // Google requires a short delay before using a page token
      await new Promise((r) => setTimeout(r, 2000));
    }

    const res = await fetch(url.toString());
    if (!res.ok) break;

    const json = (await res.json()) as GooglePlacesNearbyResponse;
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: json.error_message || `Places API error: ${json.status}` },
        { status: 502 }
      );
    }

    if (json.results) allResults.push(...json.results);

    // Stop if there are no more pages
    if (!("next_page_token" in json) || !json.next_page_token) break;
    pageToken = json.next_page_token as string;
  }

  if (allResults.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Check which place_ids are already in CRM
  const placeIds = allResults
    .map((p) => p.place_id)
    .filter(Boolean);

  const { data: existing } = await supabase
    .from("synced_contacts")
    .select("place_id")
    .in("place_id", placeIds);

  const existingIds = new Set((existing ?? []).map((r) => r.place_id).filter(Boolean));

  const results: DiscoveryResult[] = allResults
    .filter((p) => p.geometry?.location)
    .map((p) => ({
      place_id: p.place_id,
      name: p.name,
      address: p.vicinity || "",
      lat: p.geometry!.location.lat,
      lng: p.geometry!.location.lng,
      rating: p.rating ?? null,
      user_ratings_total: p.user_ratings_total ?? null,
      phone: p.formatted_phone_number ?? null,
      website: p.website ?? null,
      types: p.types ?? [],
      already_in_crm: existingIds.has(p.place_id),
    }));

  return NextResponse.json({ data: results, count: results.length });
}

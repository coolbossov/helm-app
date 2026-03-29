// POST /api/leads/discover
// Calls Google Places Nearby Search (New) API server-side.
// Returns up to 20 nearby places matching the given keyword.
// Supports either center+radius OR viewport bounds.
// Uses Places API (New): https://places.googleapis.com/v1/places:searchNearby

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const viewportSchema = z.object({
  keyword: z.string().min(1).max(100),
  north: z.number().min(-90).max(90),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
}).refine((data) => data.north > data.south, {
  message: "north must be greater than south",
  path: ["north"],
}).refine((data) => data.east > data.west, {
  message: "viewport cannot cross the antimeridian (east must be greater than west)",
  path: ["east"],
});

const radiusSchema = z.object({
  keyword: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(500).max(50000),
});

const schema = z.union([viewportSchema, radiusSchema]);

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

// Places API (New) response types
interface PlacesNewPlace {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  primaryType?: string;
}

interface PlacesNewResponse {
  places?: PlacesNewPlace[];
  error?: { code: number; message: string; status: string };
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.types",
  "places.primaryType",
].join(",");

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

  const { keyword } = parsed.data;
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  // Places API (New) Text Search with either a viewport rectangle
  // or center/radius fallback for backward compatibility.
  const requestBody =
    "north" in parsed.data
      ? {
          textQuery: keyword,
          locationRestriction: {
            rectangle: {
              low: {
                latitude: parsed.data.south,
                longitude: parsed.data.west,
              },
              high: {
                latitude: parsed.data.north,
                longitude: parsed.data.east,
              },
            },
          },
          maxResultCount: 20,
        }
      : {
          textQuery: keyword,
          locationBias: {
            circle: {
              center: {
                latitude: parsed.data.lat,
                longitude: parsed.data.lng,
              },
              radius: parsed.data.radius,
            },
          },
          maxResultCount: 20,
        };

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return NextResponse.json(
      { error: `Places API error: ${res.status} ${errorBody}` },
      { status: 502 }
    );
  }

  const json = (await res.json()) as PlacesNewResponse;

  if (json.error) {
    return NextResponse.json(
      { error: json.error.message || `Places API error: ${json.error.status}` },
      { status: 502 }
    );
  }

  const allResults = json.places ?? [];

  if (allResults.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Check which place_ids are already in CRM
  const placeIds = allResults.map((p) => p.id).filter(Boolean);

  const { data: existing } = await supabase
    .from("synced_contacts")
    .select("place_id")
    .in("place_id", placeIds);

  const existingIds = new Set((existing ?? []).map((r) => r.place_id).filter(Boolean));

  const results: DiscoveryResult[] = allResults
    .filter((p) => p.location)
    .map((p) => ({
      place_id: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingCount ?? null,
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      types: p.types ?? (p.primaryType ? [p.primaryType] : []),
      already_in_crm: existingIds.has(p.id),
    }));

  return NextResponse.json({ data: results, count: results.length });
}

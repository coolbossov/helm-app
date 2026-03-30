import { createAdminClient } from "@/lib/supabase/admin";
import type { GeocodeResponse } from "@/types";

const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

interface GoogleGeocodeResult {
  geometry: {
    location: { lat: number; lng: number };
  };
  formatted_address: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeResult[];
}

export async function geocodeAddress(
  address: string
): Promise<GeocodeResponse> {
  const supabase = createAdminClient();

  // Check cache first
  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("*")
    .eq("address_input", address)
    .single();

  if (cached) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      formatted_address: cached.formatted_address,
      status: cached.status as GeocodeResponse["status"],
      cached: true,
    };
  }

  // Call Google Geocoding API
  const params = new URLSearchParams({
    address,
    key: process.env.GOOGLE_MAPS_SERVER_KEY!,
  });

  const response = await fetch(`${GEOCODE_API}?${params.toString()}`);
  const data: GoogleGeocodeResponse = await response.json();

  let result: GeocodeResponse;

  if (data.status === "OK" && data.results.length > 0) {
    const geo = data.results[0];
    result = {
      latitude: geo.geometry.location.lat,
      longitude: geo.geometry.location.lng,
      formatted_address: geo.formatted_address,
      status: "OK",
      cached: false,
    };
  } else if (data.status === "ZERO_RESULTS") {
    result = {
      latitude: null,
      longitude: null,
      formatted_address: null,
      status: "ZERO_RESULTS",
      cached: false,
    };
  } else {
    result = {
      latitude: null,
      longitude: null,
      formatted_address: null,
      status: "ERROR",
      cached: false,
    };
  }

  // Store in cache
  await supabase.from("geocode_cache").upsert(
    {
      address_input: address,
      latitude: result.latitude,
      longitude: result.longitude,
      formatted_address: result.formatted_address,
      status: result.status,
    },
    { onConflict: "address_input" }
  );

  return result;
}

/**
 * Batch geocode contacts that have addresses but no lat/lng.
 * Throttles to ~50 req/sec.
 */
async function batchGeocodeByTarget(target: "contacts" | "companies"): Promise<number> {
  const supabase = createAdminClient();

  if (target === "companies") {
    const { data: records, error } = await supabase
      .from("synced_companies")
      .select("id, billing_street, billing_city, billing_state, billing_zip")
      .eq("geocode_status", "pending")
      .not("billing_street", "is", null)
      .limit(500);

    if (error || !records?.length) return 0;

    let geocoded = 0;
    for (const record of records) {
      const address = [
        record.billing_street,
        record.billing_city,
        record.billing_state,
        record.billing_zip,
      ]
        .filter(Boolean)
        .join(", ");

      if (!address) {
        await supabase
          .from("synced_companies")
          .update({ geocode_status: "no_address" })
          .eq("id", record.id);
        continue;
      }

      try {
        const result = await geocodeAddress(address);
        if (result.status === "OK") {
          await supabase
            .from("synced_companies")
            .update({ latitude: result.latitude, longitude: result.longitude, geocode_status: "success" })
            .eq("id", record.id);
          geocoded++;
        } else {
          await supabase
            .from("synced_companies")
            .update({ geocode_status: "failed" })
            .eq("id", record.id);
        }
      } catch (err) {
        console.error(`Geocode failed for companies ${record.id}:`, err);
        await supabase
          .from("synced_companies")
          .update({ geocode_status: "failed" })
          .eq("id", record.id);
      }

      if (!geocoded || geocoded % 50 !== 0) {
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    return geocoded;
  }

  const { data: records, error } = await supabase
    .from("synced_contacts")
    .select("id, mailing_street, mailing_city, mailing_state, mailing_zip")
    .eq("geocode_status", "pending")
    .not("mailing_street", "is", null)
    .limit(500);

  if (error || !records?.length) return 0;

  let geocoded = 0;

  for (const record of records) {
    const address = [
      record.mailing_street,
      record.mailing_city,
      record.mailing_state,
      record.mailing_zip,
    ]
      .filter(Boolean)
      .join(", ");

    if (!address) {
      await supabase
        .from("synced_contacts")
        .update({ geocode_status: "no_address" })
        .eq("id", record.id);
      continue;
    }

    try {
      const result = await geocodeAddress(address);

        if (result.status === "OK") {
        await supabase
          .from("synced_contacts")
          .update({
            latitude: result.latitude,
            longitude: result.longitude,
            geocode_status: "success",
          })
          .eq("id", record.id);
        geocoded++;
      } else {
        await supabase
          .from("synced_contacts")
          .update({ geocode_status: "failed" })
          .eq("id", record.id);
      }
    } catch (err) {
      console.error(`Geocode failed for contacts ${record.id}:`, err);
      await supabase
        .from("synced_contacts")
        .update({ geocode_status: "failed" })
        .eq("id", record.id);
    }

    // Throttle: ~50 req/sec = 20ms between requests
    if (!geocoded || geocoded % 50 !== 0) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  return geocoded;
}

export async function batchGeocodeContacts(): Promise<number> {
  return batchGeocodeByTarget("contacts");
}

export async function batchGeocodeCompanies(): Promise<number> {
  return batchGeocodeByTarget("companies");
}

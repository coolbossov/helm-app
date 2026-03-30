/**
 * scripts/backfill-billing-address.ts
 *
 * Checks all Bigin (Zoho) company accounts for missing Billing_* address fields.
 * For companies that have a Google_Maps value but no Billing_Street, attempts to
 * resolve the address via Google Geocoding API and write Billing_* fields back to Bigin.
 *
 * Usage:
 *   npx tsx scripts/backfill-billing-address.ts [--dry-run]
 *
 * Required env vars:
 *   BIGIN_REFRESH_TOKEN, BIGIN_CLIENT_ID, BIGIN_CLIENT_SECRET
 *   GOOGLE_MAPS_SERVER_KEY
 */

import { fetchAllAccounts, updateAccount } from "../lib/zoho/client";
import type { ZohoAccount } from "../types";

const DRY_RUN = process.argv.includes("--dry-run");

const GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";

interface AddressComponents {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function extractQueryFromGoogleMapsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    // https://maps.google.com/?q=... or https://www.google.com/maps?q=...
    const q = url.searchParams.get("q");
    if (q) return q;
    // https://maps.google.com/maps/place/... — last path segment sometimes has name+address
    const daddr = url.searchParams.get("daddr");
    if (daddr) return daddr;
  } catch {
    // Not a URL — treat the raw string as an address
  }
  return value.trim() || null;
}

async function geocodeToComponents(query: string): Promise<AddressComponents | null> {
  const params = new URLSearchParams({
    address: query,
    key: process.env.GOOGLE_MAPS_SERVER_KEY!,
  });

  const res = await fetch(`${GEOCODE_API}?${params}`);
  const data = await res.json() as {
    status: string;
    results: Array<{
      formatted_address: string;
      address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
    }>;
  };

  if (data.status !== "OK" || !data.results.length) return null;

  const components = data.results[0].address_components;

  const get = (type: string, short = false) =>
    components.find((c) => c.types.includes(type))?.[short ? "short_name" : "long_name"] ?? null;

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [streetNumber, route].filter(Boolean).join(" ") || null;
  const city = get("locality") ?? get("sublocality") ?? get("postal_town");
  const state = get("administrative_area_level_1", true); // e.g. "CA"
  const zip = get("postal_code");

  return { street, city, state, zip };
}

async function main() {
  if (!process.env.GOOGLE_MAPS_SERVER_KEY) {
    console.error("ERROR: GOOGLE_MAPS_SERVER_KEY not set");
    process.exit(1);
  }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}\n`);
  console.log("Fetching all Bigin accounts...");

  const accounts: ZohoAccount[] = await fetchAllAccounts();
  console.log(`Total accounts: ${accounts.length}\n`);

  const missing = accounts.filter((a) => !a.Billing_Street);
  const withGoogleMaps = missing.filter((a) => a.Google_Maps);
  const withoutAnything = missing.filter((a) => !a.Google_Maps);

  console.log(`--- Summary ---`);
  console.log(`Has billing address:       ${accounts.length - missing.length}`);
  console.log(`Missing billing address:   ${missing.length}`);
  console.log(`  ↳ Has Google_Maps:       ${withGoogleMaps.length}`);
  console.log(`  ↳ No address data at all: ${withoutAnything.length}`);
  console.log();

  if (withoutAnything.length > 0) {
    console.log("--- Companies with NO address data (cannot fix) ---");
    for (const a of withoutAnything) {
      console.log(`  • ${a.Account_Name} (id: ${a.id})`);
    }
    console.log();
  }

  if (withGoogleMaps.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  console.log("--- Backfilling from Google_Maps ---");
  let fixed = 0;
  let failed = 0;
  const failedList: string[] = [];

  for (const account of withGoogleMaps) {
    const raw = account.Google_Maps as string;
    const query = extractQueryFromGoogleMapsUrl(raw);

    if (!query) {
      console.log(`  SKIP  ${account.Account_Name} — Google_Maps value is empty`);
      failed++;
      failedList.push(`${account.Account_Name}: empty Google_Maps`);
      continue;
    }

    let components: AddressComponents | null = null;
    try {
      components = await geocodeToComponents(query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  FAIL  ${account.Account_Name} — geocode error: ${msg}`);
      failed++;
      failedList.push(`${account.Account_Name}: geocode error — ${msg}`);
      continue;
    }

    if (!components || !components.street) {
      console.log(`  FAIL  ${account.Account_Name} — geocode returned no street (query: "${query}")`);
      failed++;
      failedList.push(`${account.Account_Name}: geocode failed for "${query}"`);
      continue;
    }

    const biginUpdate: Record<string, string | null> = {};
    if (components.street) biginUpdate.Billing_Street = components.street;
    if (components.city)   biginUpdate.Billing_City  = components.city;
    if (components.state)  biginUpdate.Billing_State = components.state;
    if (components.zip)    biginUpdate.Billing_Code  = components.zip;

    if (DRY_RUN) {
      console.log(`  DRY   ${account.Account_Name}`);
      console.log(`        Would set: ${JSON.stringify(biginUpdate)}`);
    } else {
      try {
        await updateAccount(account.id, biginUpdate);
        console.log(`  OK    ${account.Account_Name} → ${components.street}, ${components.city}, ${components.state} ${components.zip}`);
        fixed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  FAIL  ${account.Account_Name} — Bigin write error: ${msg}`);
        failed++;
        failedList.push(`${account.Account_Name}: Bigin write failed — ${msg}`);
      }
    }

    // Throttle: 250ms between geocode calls + 300ms after Bigin writes
    await new Promise((r) => setTimeout(r, !DRY_RUN ? 300 : 50));
  }

  console.log();
  console.log("--- Done ---");
  if (DRY_RUN) {
    console.log(`Would have updated: ${withGoogleMaps.length} companies`);
  } else {
    console.log(`Updated: ${fixed} / ${withGoogleMaps.length}`);
    if (failedList.length > 0) {
      console.log(`Failed (${failed}):`);
      for (const f of failedList) console.log(`  • ${f}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createRouteSchema = z.object({
  name: z.string().min(1).max(100),
  planned_date: z.string().nullable().optional(),
  stop_ids: z.array(z.string().uuid()).optional(), // company IDs in order
});

type CompanyRow = { id: string; company_name: string };
type ContactRow = { id: string; account_name: string | null };

async function resolveCompanyContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stopIds: string[]
) {
  const { data: companies, error: companiesError } = await supabase
    .from("synced_companies")
    .select("id, company_name")
    .in("id", stopIds);

  if (companiesError) {
    throw new Error(companiesError.message);
  }

  const companyRows = (companies ?? []) as CompanyRow[];
  const companyMap = new Map(companyRows.map((c) => [c.id, c]));

  const companyNames = [...new Set(companyRows.map((c) => c.company_name).filter(Boolean))];
  let linkedContacts: ContactRow[] = [];

  if (companyNames.length > 0) {
    // Use case-insensitive match — Bigin sync may produce name casing differences
    // Build OR filter: account_name.ilike.Name1,account_name.ilike.Name2,...
    const ilikeFilter = companyNames
      .map((n) => `account_name.ilike.${n}`)
      .join(",");
    const { data: contacts, error: contactsError } = await supabase
      .from("synced_contacts")
      .select("id, account_name")
      .or(ilikeFilter);

    if (contactsError) {
      throw new Error(contactsError.message);
    }

    linkedContacts = (contacts ?? []) as ContactRow[];
  }

  const accountCounts = new Map<string, number>();
  for (const contact of linkedContacts) {
    if (!contact.account_name) continue;
    accountCounts.set(contact.account_name, (accountCounts.get(contact.account_name) ?? 0) + 1);
  }

  const contactByAccount = new Map<string, string>();
  for (const contact of linkedContacts) {
    if (!contact.account_name) continue;
    if (accountCounts.get(contact.account_name) === 1) {
      contactByAccount.set(contact.account_name, contact.id);
    }
  }

  return { companyMap, contactByAccount };
}

function isMissingCompanyColumnError(errorMessage: string) {
  return /company_id|synced_companies|column .*company_id.* does not exist/i.test(errorMessage);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_routes")
    .select("*, route_stops(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, planned_date, stop_ids } = parsed.data;

  // Create route
  const { data: route, error: routeError } = await supabase
    .from("saved_routes")
    .insert({ user_id: user.id, name, planned_date: planned_date ?? null })
    .select()
    .single();

  if (routeError) return NextResponse.json({ error: routeError.message }, { status: 500 });

  // Insert stops if provided
  if (stop_ids && stop_ids.length > 0) {
    const { companyMap, contactByAccount } = await resolveCompanyContext(supabase, stop_ids);

    const orphanCompanyIds = stop_ids.filter((companyId) => !companyMap.has(companyId));
    if (orphanCompanyIds.length > 0) {
      return NextResponse.json(
        { error: "One or more selected companies no longer exist in synced_companies" },
        { status: 400 }
      );
    }

    const companyStops = stop_ids.map((company_id, index) => {
      const company = companyMap.get(company_id);
      const contact_id = company ? contactByAccount.get(company.company_name) ?? null : null;

      return {
        route_id: route.id,
        company_id,
        contact_id,
        stop_order: index,
      };
    });

    let { error: stopsError } = await supabase.from("route_stops").insert(companyStops);

    // Legacy fallback: older schema may not have company_id yet.
    if (stopsError && isMissingCompanyColumnError(stopsError.message)) {
      const legacyStops = stop_ids.map((companyId, index) => {
        const company = companyMap.get(companyId);
        const linkedContactId = company ? contactByAccount.get(company.company_name) : undefined;

        return {
          route_id: route.id,
          contact_id: linkedContactId,
          stop_order: index,
        };
      });

      const missingLinks = legacyStops.filter((s) => !s.contact_id).length;
      if (missingLinks > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot create route on legacy schema: one or more companies have no linked contact. Apply migrations 015+017 to enable company-first route stops.",
          },
          { status: 400 }
        );
      }

      ({ error: stopsError } = await supabase.from("route_stops").insert(
        legacyStops.map((s) => ({
          route_id: s.route_id,
          contact_id: s.contact_id!,
          stop_order: s.stop_order,
        }))
      ));
    }

    // Transitional fallback: company_id exists but contact_id is still NOT NULL.
    if (stopsError && /null value in column "contact_id"/i.test(stopsError.message)) {
      const patchedStops = companyStops.map((s) => {
        if (s.contact_id) return s;
        const company = companyMap.get(s.company_id);
        const linkedContactId = company ? contactByAccount.get(company.company_name) : undefined;
        return { ...s, contact_id: linkedContactId ?? null };
      });

      const stillMissing = patchedStops.filter((s) => !s.contact_id).length;
      if (stillMissing > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot create route until route_stops.contact_id is nullable (migration 017) or all companies have linked contacts.",
          },
          { status: 400 }
        );
      }

      ({ error: stopsError } = await supabase.from("route_stops").insert(patchedStops));
    }

    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  }

  return NextResponse.json({ data: route }, { status: 201 });
}

// POST /api/routes/:id/stops
// Appends new stops to an existing route from a list of synced_companies UUIDs.
// Resolves company → contact links the same way as POST /api/routes.
// New stops are appended after the current highest stop_order.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addStopsSchema = z.object({
  stop_ids: z.array(z.string().uuid()).min(1),
});

type CompanyRow = { id: string; company_name: string };
type ContactRow = { id: string; account_name: string | null };
type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify route exists and belongs to this user
  const { data: route } = await supabase
    .from("saved_routes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addStopsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { stop_ids } = parsed.data;

  // Resolve companies
  const { data: companies, error: companiesError } = await supabase
    .from("synced_companies")
    .select("id, company_name")
    .in("id", stop_ids);

  if (companiesError) return NextResponse.json({ error: companiesError.message }, { status: 500 });

  const companyRows = (companies ?? []) as CompanyRow[];
  const companyMap = new Map(companyRows.map((c) => [c.id, c]));

  const orphans = stop_ids.filter((id) => !companyMap.has(id));
  if (orphans.length > 0) {
    return NextResponse.json(
      { error: "One or more selected companies no longer exist in synced_companies" },
      { status: 400 }
    );
  }

  // Resolve company → contact (unambiguous 1-to-1 matches only)
  // Use .in() on account_name for safe exact matching — avoids comma-injection
  // issues that arise from building raw PostgREST .or() filter strings.
  const companyNames = [...new Set(companyRows.map((c) => c.company_name).filter(Boolean))];
  const contactByAccount = new Map<string, string>();

  if (companyNames.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from("synced_contacts")
      .select("id, account_name")
      .in("account_name", companyNames);

    if (contactsError) {
      return NextResponse.json({ error: contactsError.message }, { status: 500 });
    }

    const linkedContacts = (contacts ?? []) as ContactRow[];
    const accountCounts = new Map<string, number>();
    for (const c of linkedContacts) {
      if (!c.account_name) continue;
      accountCounts.set(c.account_name, (accountCounts.get(c.account_name) ?? 0) + 1);
    }
    for (const c of linkedContacts) {
      if (!c.account_name) continue;
      if (accountCounts.get(c.account_name) === 1) {
        contactByAccount.set(c.account_name, c.id);
      }
    }
  }

  // Get current max stop_order for this route
  const { data: existingStops } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", id)
    .order("stop_order", { ascending: false })
    .limit(1);

  const maxOrder = existingStops?.[0]?.stop_order ?? -1;

  // Build new stops
  const newStops = stop_ids.map((company_id, index) => {
    const company = companyMap.get(company_id);
    const contact_id = company ? contactByAccount.get(company.company_name) ?? null : null;
    return {
      route_id: id,
      company_id,
      contact_id,
      stop_order: maxOrder + 1 + index,
    };
  });

  const { error: insertError } = await supabase.from("route_stops").insert(newStops);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data: { added: newStops.length } }, { status: 201 });
}

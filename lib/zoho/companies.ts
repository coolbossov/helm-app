import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllAccounts } from "./client";
import {
  mapBusinessType,
  mapLifecycleStage,
  mapPriority,
  mapContactingStatus,
} from "./field-mappings";
import type { ZohoAccount } from "@/types";

export interface CompanyChangeDetail {
  name: string;
  type: "created" | "updated" | "unchanged";
  fieldsChanged?: string[];
}

export interface CompanySyncResult {
  synced: number;
  created: number;
  updated: number;
  unchanged: number;
  details: CompanyChangeDetail[];
}

const DIFF_FIELDS = [
  "company_name",
  "phone",
  "website",
  "business_type",
  "billing_street",
  "billing_city",
  "billing_state",
  "billing_zip",
  "priority",
  "lifecycle_stage",
  "contacting_status",
  "contacting_tips",
  "prospecting_notes",
] as const;

const EXISTING_SELECT = ["zoho_account_id", ...DIFF_FIELDS].join(", ");

function diffCompany(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): string[] {
  const changed: string[] = [];
  for (const field of DIFF_FIELDS) {
    if (String(incoming[field] ?? "") !== String(existing[field] ?? "")) {
      changed.push(field);
    }
  }
  return changed;
}

function accountToRow(account: ZohoAccount) {
  const companyName = account.Account_Name?.trim() || "Unknown Company";
  return {
    zoho_account_id: account.id,
    company_name: companyName,
    phone: account.Phone || null,
    website: account.Website || null,
    business_type: mapBusinessType(account.Business_Type),
    billing_street: account.Billing_Street || null,
    billing_city: account.Billing_City || null,
    billing_state: account.Billing_State || null,
    billing_zip: account.Billing_Code || null,
    priority: mapPriority((account.Priority as string | undefined) ?? undefined),
    lifecycle_stage: mapLifecycleStage((account.Lifecycle_stage as string | undefined) ?? undefined),
    contacting_status: mapContactingStatus((account.Contacting_Status as string | undefined) ?? undefined),
    contacting_tips: (account.Contacting_Tips as string | undefined) || null,
    prospecting_notes: (account.Prospecting_Initial_notes as string | undefined) || null,
    zoho_modified_time: account.Modified_Time || null,
    last_synced_at: new Date().toISOString(),
  };
}

export async function syncCompanies(): Promise<CompanySyncResult> {
  const supabase = createAdminClient();
  const accounts = (await fetchAllAccounts()).filter((account) => {
    const name = account.Account_Name || "";
    return !name.toLowerCase().includes("_unknown_company");
  });

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const details: CompanyChangeDetail[] = [];

  for (let i = 0; i < accounts.length; i += 50) {
    const batch = accounts.slice(i, i + 50);
    const rows = batch.map(accountToRow);
    const accountIds = batch.map((account) => account.id);

    const { data: existingCompanies, error: existingError } = await supabase
      .from("synced_companies")
      .select(EXISTING_SELECT)
      .in("zoho_account_id", accountIds)
      .returns<Array<Record<string, unknown>>>();

    if (existingError) {
      throw new Error(`Failed to check existing companies: ${existingError.message}`);
    }

    const existingMap = new Map<string, Record<string, unknown>>(
      (existingCompanies ?? []).map((row) => [String(row.zoho_account_id), row])
    );

    for (const row of rows) {
      const existing = existingMap.get(row.zoho_account_id);
      if (!existing) {
        created++;
        details.push({ name: row.company_name, type: "created" });
      } else {
        const fieldsChanged = diffCompany(row, existing);
        if (fieldsChanged.length > 0) {
          updated++;
          details.push({ name: row.company_name, type: "updated", fieldsChanged });
        } else {
          unchanged++;
          details.push({ name: row.company_name, type: "unchanged" });
        }
      }
    }

    const { error } = await supabase
      .from("synced_companies")
      .upsert(rows, { onConflict: "zoho_account_id" });

    if (error) {
      throw new Error(`Failed to upsert companies: ${error.message}`);
    }
  }

  await supabase
    .from("synced_companies")
    .update({ geocode_status: "no_address" })
    .is("billing_street", null)
    .is("billing_city", null)
    .eq("geocode_status", "pending");

  return {
    synced: accounts.length,
    created,
    updated,
    unchanged,
    details,
  };
}

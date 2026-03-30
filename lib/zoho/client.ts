import { getAccessToken } from "./token";
import type { ZohoListResponse, ZohoContact, ZohoAccount } from "@/types";

const BIGIN_API_BASE = "https://www.zohoapis.com/bigin/v2";

// Bigin v2 requires explicit field selection — omitting fields returns REQUIRED_PARAM_MISSING
const CONTACT_FIELDS = [
  "Last_Name",
  "First_Name",
  "Account_Name",
  "Email",
  "Phone",
  "Mobile",
  "Website",
  "Mailing_Street",
  "Mailing_City",
  "Mailing_State",
  "Mailing_Zip",
  "Mailing_Country",
  "Business_Type",
  "Priority",
  "Lifecycle_stage",
  "Contacting_Status",
  "Contacting_Tips",
  "Prospecting_Initial_notes",
  "Created_Time",
  "Modified_Time",
].join(",");

const ACCOUNT_FIELDS = [
  "Account_Name",
  "Phone",
  "Website",
  "Business_Type",
  "Billing_Street",
  "Billing_City",
  "Billing_State",
  "Billing_Code",
  "Google_Maps",
  "Modified_Time",
].join(",");

async function zohoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BIGIN_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho API ${response.status}: ${text}`);
  }

  return response.json();
}

export async function fetchAllContacts(): Promise<ZohoContact[]> {
  const allContacts: ZohoContact[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse>(
      `/Contacts?fields=${CONTACT_FIELDS}&page=${page}&per_page=200`
    );

    if (response.data) {
      allContacts.push(...response.data);
    }

    hasMore = response.info?.more_records ?? false;
    page++;

    // Small delay between pages to respect rate limits
    if (hasMore) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allContacts;
}

export async function fetchAllAccounts(): Promise<ZohoAccount[]> {
  const allAccounts: ZohoAccount[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse<ZohoAccount>>(
      `/Accounts?fields=${ACCOUNT_FIELDS}&page=${page}&per_page=200`
    );

    if (response.data) {
      allAccounts.push(...response.data);
    }

    hasMore = response.info?.more_records ?? false;
    page++;

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allAccounts;
}

export async function fetchContactsSince(
  modifiedTime: string
): Promise<ZohoContact[]> {
  const allContacts: ZohoContact[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse>(
      `/Contacts?fields=${CONTACT_FIELDS}&page=${page}&per_page=200&modified_since=${modifiedTime}`
    );

    if (response.data) {
      allContacts.push(...response.data);
    }

    hasMore = response.info?.more_records ?? false;
    page++;

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allContacts;
}

export async function fetchAccountsSince(
  modifiedTime: string
): Promise<ZohoAccount[]> {
  const allAccounts: ZohoAccount[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse<ZohoAccount>>(
      `/Accounts?fields=${ACCOUNT_FIELDS}&page=${page}&per_page=200&modified_since=${modifiedTime}`
    );

    if (response.data) {
      allAccounts.push(...response.data);
    }

    hasMore = response.info?.more_records ?? false;
    page++;

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allAccounts;
}

export async function updateContact(
  zohoId: string,
  data: Record<string, unknown>
): Promise<void> {
  await zohoFetch(`/Contacts/${zohoId}`, {
    method: "PUT",
    body: JSON.stringify({ data: [data] }),
  });
}

export async function updateAccount(
  zohoAccountId: string,
  data: Record<string, unknown>
): Promise<void> {
  await zohoFetch(`/Accounts/${zohoAccountId}`, {
    method: "PUT",
    body: JSON.stringify({ data: [data] }),
  });
}

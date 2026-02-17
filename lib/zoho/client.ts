import { getAccessToken } from "./token";
import type { ZohoListResponse, ZohoContact } from "@/types";

const BIGIN_API_BASE = "https://www.zohoapis.com/bigin/v2";

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
      `/Contacts?page=${page}&per_page=200`
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

export async function fetchContactsSince(
  modifiedTime: string
): Promise<ZohoContact[]> {
  const allContacts: ZohoContact[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await zohoFetch<ZohoListResponse>(
      `/Contacts?page=${page}&per_page=200&modified_since=${modifiedTime}`
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

export async function updateContact(
  zohoId: string,
  data: Record<string, unknown>
): Promise<void> {
  await zohoFetch(`/Contacts/${zohoId}`, {
    method: "PUT",
    body: JSON.stringify({ data: [data] }),
  });
}

import type { ZohoTokenResponse } from "@/types";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_BIGIN_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_BIGIN_CLIENT_ID!,
    client_secret: process.env.ZOHO_BIGIN_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });

  const response = await fetch(
    `https://accounts.zoho.com/oauth/v2/token?${params.toString()}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Zoho token refresh failed: ${response.status}`);
  }

  const data: ZohoTokenResponse = await response.json();

  if (data.error) {
    throw new Error(`Zoho token error: ${data.error}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

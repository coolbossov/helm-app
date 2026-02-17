export type GeocodeResultStatus = "OK" | "ZERO_RESULTS" | "ERROR";

export interface GeocodeCache {
  id: string;
  address_input: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  status: GeocodeResultStatus;
  created_at: string;
}

export interface GeocodeRequest {
  address: string;
  contactId?: string;
}

export interface GeocodeResponse {
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  status: GeocodeResultStatus;
  cached: boolean;
}

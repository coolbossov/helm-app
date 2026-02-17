export interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  api_domain: string;
  token_type: string;
  error?: string;
}

export interface ZohoContact {
  id: string;
  Last_Name: string;
  First_Name?: string;
  Account_Name?: { name: string; id: string };
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Website?: string;
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Zip?: string;
  Mailing_Country?: string;
  Business_Type?: ZohoMultiselect[];
  Priority?: string;
  Lifecycle_stage?: string;
  Contacting_Status?: string;
  Contacting_Tips?: string;
  Prospecting_Initial_notes?: string;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: unknown;
}

export interface ZohoMultiselect {
  display_value: string;
  actual_value: string;
}

export interface ZohoListResponse {
  data: ZohoContact[];
  info: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
  };
}

export interface ZohoErrorResponse {
  code: string;
  details: Record<string, unknown>;
  message: string;
  status: string;
}

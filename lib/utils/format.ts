export function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function formatAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): string {
  return [street, city, state, zip].filter(Boolean).join(", ");
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  return miles < 10
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(miles)} mi`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function getDisplayName(contact: {
  last_name: string;
  account_name: string | null;
}): string {
  return contact.account_name || contact.last_name;
}

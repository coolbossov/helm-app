"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContactMarkerData, SyncedContact } from "@/types";
import { cacheSet, cacheGet } from "@/lib/offline/idb-cache";

export function useContacts() {
  const [markers, setMarkers] = useState<ContactMarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts?map=true");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const json = await res.json();
      const data: ContactMarkerData[] = json.data ?? [];
      setMarkers(data);
      // Cache for offline use
      cacheSet("contacts", data).catch(() => {/* ignore */});
    } catch (err) {
      // Fallback to IndexedDB cache when offline
      const cached = await cacheGet<ContactMarkerData>("contacts").catch(() => []);
      if (cached.length > 0) {
        setMarkers(cached);
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  return { markers, loading, error, refetch: fetchMarkers };
}

export function useContactDetail(id: string | null) {
  const [contact, setContact] = useState<SyncedContact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setContact(null);
      return;
    }

    setLoading(true);
    fetch(`/api/contacts/${id}`)
      .then((res) => res.json())
      .then((json) => setContact(json.data ?? null))
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { contact, loading };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { CompanyMarkerData, SyncedContact } from "@/types";
import { cacheSet, cacheGet } from "@/lib/offline/idb-cache";

export function useCompanies() {
  const [markers, setMarkers] = useState<CompanyMarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTruncated(false);
    try {
      const res = await fetch("/api/contacts?map=true");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const json = await res.json();
      const data: CompanyMarkerData[] = json.data ?? [];
      setMarkers(data);
      setTruncated(json.truncated === true);
      // Cache for offline use
      cacheSet("contacts", data).catch(() => {/* ignore */});
    } catch (err) {
      // Fallback to IndexedDB cache when offline
      const cached = await cacheGet<CompanyMarkerData>("contacts").catch(() => []);
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

  return { markers, loading, error, truncated, refetch: fetchMarkers };
}

export function useContactDetail(id: string | null) {
  const [contact, setContact] = useState<SyncedContact | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContact = useCallback(() => {
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

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  return { contact, loading, refetch: fetchContact };
}

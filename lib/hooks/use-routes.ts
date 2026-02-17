"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedRoute, RouteStop } from "@/types/routes";
import { enqueueOfflineMutation } from "@/lib/offline/sync-queue";

interface RouteWithStops extends SavedRoute {
  route_stops: Array<RouteStop & {
    synced_contacts: {
      id: string;
      first_name: string | null;
      last_name: string;
      account_name: string | null;
      mailing_street: string | null;
      mailing_city: string | null;
      mailing_state: string | null;
      mailing_zip: string | null;
      latitude: number | null;
      longitude: number | null;
      business_type: string[];
      priority: string | null;
      phone: string | null;
      mobile: string | null;
    } | null;
  }>;
}

export function useRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routes");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load routes");
      setRoutes(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  const createRoute = useCallback(async (name: string, stopIds: string[], plannedDate?: string) => {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stop_ids: stopIds, planned_date: plannedDate }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create route");
    await fetchRoutes();
    return json.data as SavedRoute;
  }, [fetchRoutes]);

  const deleteRoute = useCallback(async (id: string) => {
    await fetch(`/api/routes/${id}`, { method: "DELETE" });
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { routes, loading, error, createRoute, deleteRoute, refresh: fetchRoutes };
}

export function useRoute(id: string | null) {
  const [route, setRoute] = useState<RouteWithStops | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/routes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load route");
      setRoute(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRoute(); }, [fetchRoute]);

  const updateStopStatus = useCallback(async (
    stopId: string,
    status: "pending" | "visited" | "skipped"
  ) => {
    if (!id) return;

    // Optimistic update
    setRoute((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        route_stops: prev.route_stops.map((s) =>
          s.id === stopId
            ? { ...s, status, visited_at: status === "visited" ? new Date().toISOString() : s.visited_at }
            : s
        ),
      };
    });

    try {
      const res = await fetch(`/api/routes/${id}/stops/${stopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Server error");
    } catch {
      // Queue for replay when back online
      await enqueueOfflineMutation("PATCH", `/api/routes/${id}/stops/${stopId}`, { status });
    }
  }, [id]);

  const optimizeRoute = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/routes/${id}/optimize`, { method: "POST" });
    if (res.ok) await fetchRoute();
    return res.ok;
  }, [id, fetchRoute]);

  return { route, loading, error, updateStopStatus, optimizeRoute, refresh: fetchRoute };
}

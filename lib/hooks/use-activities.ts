"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContactActivity, CreateActivityInput } from "@/types";

export function useActivities(contactId: string | null) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!contactId) {
      setActivities([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/activities`);
      if (!res.ok) return;
      const json = await res.json();
      setActivities(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addActivity = useCallback(
    async (input: CreateActivityInput): Promise<boolean> => {
      if (!contactId) return false;
      try {
        const res = await fetch(`/api/contacts/${contactId}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) return false;
        const json = await res.json();
        setActivities((prev) => [json.data, ...prev]);
        return true;
      } catch {
        return false;
      }
    },
    [contactId]
  );

  return { activities, loading, addActivity, refresh: fetchActivities };
}

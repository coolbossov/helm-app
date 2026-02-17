"use client";

import { useState, useCallback } from "react";
import type { ContactMarkerData } from "@/types";

export interface BuilderStop {
  contact: ContactMarkerData;
  order: number;
}

export function useRouteBuilder() {
  const [stops, setStops] = useState<BuilderStop[]>([]);
  const [routeName, setRouteName] = useState("");

  const addStop = useCallback((contact: ContactMarkerData) => {
    setStops((prev) => {
      if (prev.some((s) => s.contact.id === contact.id)) return prev;
      return [...prev, { contact, order: prev.length }];
    });
  }, []);

  const removeStop = useCallback((contactId: string) => {
    setStops((prev) => {
      const filtered = prev.filter((s) => s.contact.id !== contactId);
      return filtered.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const moveStop = useCallback((fromIndex: number, toIndex: number) => {
    setStops((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const clearStops = useCallback(() => setStops([]), []);

  const hasStop = useCallback(
    (contactId: string) => stops.some((s) => s.contact.id === contactId),
    [stops]
  );

  const addMultipleStops = useCallback((contacts: ContactMarkerData[]) => {
    setStops((prev) => {
      const existingIds = new Set(prev.map((s) => s.contact.id));
      const newOnes = contacts.filter((c) => !existingIds.has(c.id));
      const added = newOnes.map((contact, i) => ({
        contact,
        order: prev.length + i,
      }));
      return [...prev, ...added];
    });
  }, []);

  return {
    stops,
    routeName,
    setRouteName,
    addStop,
    removeStop,
    moveStop,
    clearStops,
    hasStop,
    addMultipleStops,
  };
}

"use client";

import { useState, useCallback } from "react";
import type { CompanyMarkerData } from "@/types";

export interface BuilderStop {
  company: CompanyMarkerData;
  order: number;
}

export function useRouteBuilder() {
  const [stops, setStops] = useState<BuilderStop[]>([]);
  const [routeName, setRouteName] = useState("");

  const addStop = useCallback((company: CompanyMarkerData) => {
    setStops((prev) => {
      if (prev.some((s) => s.company.id === company.id)) return prev;
      return [...prev, { company, order: prev.length }];
    });
  }, []);

  const removeStop = useCallback((companyId: string) => {
    setStops((prev) => {
      const filtered = prev.filter((s) => s.company.id !== companyId);
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
    (companyId: string) => stops.some((s) => s.company.id === companyId),
    [stops]
  );

  const addMultipleStops = useCallback((companies: CompanyMarkerData[]) => {
    setStops((prev) => {
      const existingIds = new Set(prev.map((s) => s.company.id));
      const newOnes = companies.filter((c) => !existingIds.has(c.id));
      const added = newOnes.map((company, i) => ({
        company,
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

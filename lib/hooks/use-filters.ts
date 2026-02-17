"use client";

import { useState, useMemo, useCallback } from "react";
import type { ContactFilters, ContactMarkerData } from "@/types";

const INITIAL_FILTERS: ContactFilters = {
  business_types: [],
  priorities: [],
  lifecycle_stages: [],
  contacting_statuses: [],
  search: "",
};

export function useFilters(markers: ContactMarkerData[]) {
  const [filters, setFilters] = useState<ContactFilters>(INITIAL_FILTERS);

  const filtered = useMemo(() => {
    return markers.filter((m) => {
      // Business type filter
      if (filters.business_types.length > 0) {
        const hasMatch = m.business_type.some((t) =>
          filters.business_types.includes(t)
        );
        if (!hasMatch) return false;
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        if (!m.priority || !filters.priorities.includes(m.priority)) return false;
      }

      // Lifecycle stage filter
      if (filters.lifecycle_stages.length > 0) {
        if (
          !m.lifecycle_stage ||
          !filters.lifecycle_stages.includes(m.lifecycle_stage)
        )
          return false;
      }

      // Contacting status filter
      if (filters.contacting_statuses.length > 0) {
        if (
          !m.contacting_status ||
          !filters.contacting_statuses.includes(m.contacting_status)
        )
          return false;
      }

      // Search filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const name = (m.account_name || m.last_name).toLowerCase();
        if (!name.includes(q)) return false;
      }

      return true;
    });
  }, [markers, filters]);

  const updateFilter = useCallback(
    <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.business_types.length) count++;
    if (filters.priorities.length) count++;
    if (filters.lifecycle_stages.length) count++;
    if (filters.contacting_statuses.length) count++;
    return count;
  }, [filters]);

  return { filters, filtered, updateFilter, resetFilters, activeFilterCount };
}

"use client";

import { useState, useEffect } from "react";

export function useCoverage(enabled: boolean) {
  const [coverageMap, setCoverageMap] = useState<Map<string, Date>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setCoverageMap(new Map());
      return;
    }

    fetch("/api/contacts/coverage")
      .then((res) => res.json())
      .then((json) => {
        const map = new Map<string, Date>();
        for (const row of json.data ?? []) {
          map.set(row.contact_id, new Date(row.last_visited_at));
        }
        setCoverageMap(map);
      })
      .catch(() => {/* ignore */});
  }, [enabled]);

  return { coverageMap };
}

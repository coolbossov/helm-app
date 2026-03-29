"use client";

import { useState, useEffect, memo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { VISIT_STATUS_COLORS, type VisitStatus } from "@/types";

const LEGEND_ITEMS: { status: VisitStatus; label: string }[] = [
  { status: "Never Visited",    label: "Never visited" },
  { status: "Visited Recently", label: "Visited (≤30d)" },
  { status: "Needs Follow-up",  label: "Follow-up needed" },
  { status: "Hot Lead",         label: "Hot lead" },
  { status: "Not Interested",   label: "Not interested" },
  { status: "Closed Won",       label: "Closed won" },
];

const STORAGE_KEY = "sapd-legend-collapsed";

export const VisitStatusLegend = memo(function VisitStatusLegend() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2"
      >
        <p className="text-[10px] font-semibold uppercase text-gray-500">
          Visit Status
        </p>
        {collapsed ? (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronUp className="h-3 w-3 text-gray-400" />
        )}
      </button>
      {!collapsed && (
        <div className="mt-1.5 space-y-1">
          {LEGEND_ITEMS.map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: VISIT_STATUS_COLORS[status] }}
              />
              <span className="text-xs text-gray-700">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

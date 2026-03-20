"use client";

import { VISIT_STATUS_COLORS, type VisitStatus } from "@/types";

const LEGEND_ITEMS: { status: VisitStatus; label: string }[] = [
  { status: "Never Visited",    label: "Never visited" },
  { status: "Visited Recently", label: "Visited (≤30d)" },
  { status: "Needs Follow-up",  label: "Follow-up needed" },
  { status: "Hot Lead",         label: "Hot lead" },
  { status: "Not Interested",   label: "Not interested" },
  { status: "Closed Won",       label: "Closed won" },
];

export function VisitStatusLegend() {
  return (
    <div className="rounded-lg bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold uppercase text-gray-500">
        Visit Status
      </p>
      <div className="space-y-1">
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
    </div>
  );
}

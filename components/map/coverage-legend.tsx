"use client";

export function CoverageLegend() {
  return (
    <div className="rounded-lg bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-semibold text-gray-500 uppercase">Coverage</p>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_0_2px_#22c55e]" />
          <span className="text-xs text-gray-700">Visited ≤30d</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-yellow-400 shadow-[0_0_0_2px_#eab308]" />
          <span className="text-xs text-gray-700">Visited 30-90d</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_0_2px_#ef4444]" />
          <span className="text-xs text-gray-700">Never / &gt;90d</span>
        </div>
      </div>
    </div>
  );
}

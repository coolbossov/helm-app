"use client";

import { memo } from "react";
import { MapPin, Eye } from "lucide-react";

interface MapStatsProps {
  total: number;
  visible: number;
}

export const MapStats = memo(function MapStats({ total, visible }: MapStatsProps) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {total.toLocaleString()} total
      </span>
      {visible !== total && (
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          {visible.toLocaleString()} shown
        </span>
      )}
    </div>
  );
});

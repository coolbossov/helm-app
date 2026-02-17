import { MapPin, Clock, Navigation } from "lucide-react";
import { formatDistance, formatDuration } from "@/lib/utils";

interface RouteStatsProps {
  stopCount: number;
  totalDistanceMeters?: number | null;
  totalDurationSeconds?: number | null;
}

export function RouteStats({ stopCount, totalDistanceMeters, totalDurationSeconds }: RouteStatsProps) {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <span className="flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        {stopCount} {stopCount === 1 ? "stop" : "stops"}
      </span>
      {totalDistanceMeters != null && totalDistanceMeters > 0 && (
        <span className="flex items-center gap-1">
          <Navigation className="h-3.5 w-3.5" />
          {formatDistance(totalDistanceMeters)}
        </span>
      )}
      {totalDurationSeconds != null && totalDurationSeconds > 0 && (
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDuration(totalDurationSeconds)}
        </span>
      )}
    </div>
  );
}

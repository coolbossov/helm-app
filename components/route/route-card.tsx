"use client";

import Link from "next/link";
import { Trash2, ChevronRight, Calendar } from "lucide-react";
import { RouteStats } from "./route-stats";
import type { SavedRoute } from "@/types/routes";

interface RouteCardProps {
  route: SavedRoute & { route_stops?: { count: number }[] };
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  planned: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const statusLabels: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

export function RouteCard({ route, onDelete }: RouteCardProps) {
  const stopCount = route.route_stops?.[0]?.count ?? 0;

  return (
    <div className="flex items-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <Link href={`/routes/${route.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="truncate font-semibold text-gray-900">{route.name}</h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[route.status]}`}>
            {statusLabels[route.status]}
          </span>
        </div>
        <RouteStats
          stopCount={stopCount}
          totalDistanceMeters={route.total_distance_meters}
          totalDurationSeconds={route.total_duration_seconds}
        />
        {route.planned_date && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="h-3 w-3" />
            {new Date(route.planned_date).toLocaleDateString()}
          </div>
        )}
      </Link>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onDelete(route.id)}
          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </div>
  );
}

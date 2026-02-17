"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Route } from "lucide-react";
import { RouteCard } from "@/components/route/route-card";
import { Button, Spinner } from "@/components/ui";
import { useRoutes } from "@/lib/hooks/use-routes";
import { cn } from "@/lib/utils";

const STATUS_PILLS = [
  { label: "All", value: "" },
  { label: "Planned", value: "planned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
] as const;

export default function RoutesPage() {
  const router = useRouter();
  const { routes, loading, error, deleteRoute } = useRoutes();
  const [statusFilter, setStatusFilter] = useState("");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const filteredRoutes = useMemo(() => {
    if (!statusFilter) return routes;
    return routes.filter((r) => r.status === statusFilter);
  }, [routes, statusFilter]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Routes</h1>
          <p className="text-sm text-gray-500">{routes.length} saved routes</p>
        </div>
        <Button onClick={() => router.push("/routes/new")}>
          <Plus className="h-4 w-4" />
          New Route
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {STATUS_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setStatusFilter(pill.value)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              statusFilter === pill.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {pill.label}
            {pill.value && (
              <span className="ml-1 opacity-70">
                ({routes.filter((r) => r.status === pill.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredRoutes.length === 0 && routes.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-sm">No routes match this filter</p>
        </div>
      ) : routes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Route className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-base font-medium text-gray-500 mb-1">No routes yet</p>
          <p className="text-sm mb-6">Build a route to plan your day in the field</p>
          <Button onClick={() => router.push("/routes/new")}>
            <Plus className="h-4 w-4" />
            Create your first route
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRoutes.map((route) => (
            <RouteCard key={route.id} route={route} onDelete={deleteRoute} />
          ))}
        </div>
      )}
    </div>
  );
}

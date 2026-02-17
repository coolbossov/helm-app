"use client";

import { useRouter } from "next/navigation";
import { Plus, Route } from "lucide-react";
import { RouteCard } from "@/components/route/route-card";
import { Button, Spinner } from "@/components/ui";
import { useRoutes } from "@/lib/hooks/use-routes";

export default function RoutesPage() {
  const router = useRouter();
  const { routes, loading, error, deleteRoute } = useRoutes();

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Routes</h1>
          <p className="text-sm text-gray-500">{routes.length} saved routes</p>
        </div>
        <Button onClick={() => router.push("/routes/new")}>
          <Plus className="h-4 w-4" />
          New Route
        </Button>
      </div>

      {routes.length === 0 ? (
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
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} onDelete={deleteRoute} />
          ))}
        </div>
      )}
    </div>
  );
}

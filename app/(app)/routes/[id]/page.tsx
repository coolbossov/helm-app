"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wand2,
  Navigation,
  MoreVertical,
  CheckCircle,
} from "lucide-react";
import { DrivingStop } from "@/components/route/stop-list";
import { RouteStats } from "@/components/route/route-stats";
import { Button, Spinner } from "@/components/ui";
import { useRoute } from "@/lib/hooks/use-routes";
import { getDisplayName, formatAddress } from "@/lib/utils";

interface Params {
  id: string;
}

export default function RoutePage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const router = useRouter();
  const { route, loading, error, updateStopStatus, optimizeRoute } = useRoute(id);
  const [optimizing, setOptimizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleOptimize = async () => {
    setOptimizing(true);
    await optimizeRoute();
    setOptimizing(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-600">{error || "Route not found"}</p>
      </div>
    );
  }

  const stops = route.route_stops ?? [];
  const visitedCount = stops.filter((s) => s.status === "visited").length;
  const allDone = stops.length > 0 && visitedCount === stops.length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/routes")}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-gray-900">{route.name}</h1>
          <RouteStats
            stopCount={stops.length}
            totalDistanceMeters={route.total_distance_meters}
            totalDurationSeconds={route.total_duration_seconds}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-10 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); handleOptimize(); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Wand2 className="h-4 w-4" />
                Optimize route
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {stops.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">
              {visitedCount} / {stops.length} visited
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${(visitedCount / stops.length) * 100}%` }}
            />
          </div>
          {allDone && (
            <div className="mt-3 flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Route complete!</span>
            </div>
          )}
        </div>
      )}

      {/* Optimize button when no distance info */}
      {!route.total_distance_meters && stops.length > 1 && (
        <Button
          variant="secondary"
          onClick={handleOptimize}
          disabled={optimizing}
          className="mb-4 w-full"
        >
          {optimizing ? <Spinner /> : <Wand2 className="h-4 w-4" />}
          Optimize Route
        </Button>
      )}

      {/* Stops */}
      {stops.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-10">No stops in this route</p>
      ) : (
        <div className="space-y-3">
          {stops.map((stop, index) => {
            const contact = stop.synced_contacts;
            if (!contact) return null;

            const name = getDisplayName(contact);
            const address = formatAddress(
              contact.mailing_street,
              contact.mailing_city,
              contact.mailing_state,
              contact.mailing_zip
            );
            const navigateUrl = address
              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
              : null;

            return (
              <div key={stop.id}>
                <DrivingStop
                  index={index}
                  name={name}
                  address={address || undefined}
                  phone={contact.phone || contact.mobile || undefined}
                  status={stop.status}
                  onStatusChange={(s) => updateStopStatus(stop.id, s)}
                />
                {navigateUrl && stop.status === "pending" && (
                  <a
                    href={navigateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Navigate here
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

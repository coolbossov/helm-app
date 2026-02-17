"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wand2,
  Navigation,
  MoreVertical,
  CheckCircle,
  Map as MapIcon,
  Clock,
  Flag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DrivingStop } from "@/components/route/stop-list";
import { RouteStats } from "@/components/route/route-stats";
import { Button, Spinner } from "@/components/ui";
import { useRoute } from "@/lib/hooks/use-routes";
import { getDisplayName, formatAddress, cn } from "@/lib/utils";
import type { OptimizationMode, StopPriority } from "@/types/routes";

interface Params {
  id: string;
}

const OPTIMIZATION_MODES: { value: OptimizationMode; label: string; description: string }[] = [
  { value: "fastest", label: "Fastest", description: "Minimize drive time" },
  { value: "shortest", label: "Shortest", description: "Minimize distance" },
  { value: "strict_time_windows", label: "Time Windows", description: "Respect time windows + priority" },
];

export default function RoutePage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const router = useRouter();
  const { route, loading, error, updateStopStatus, updateStopMeta, optimizeRoute } = useRoute(id);
  const [optimizing, setOptimizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<OptimizationMode>("fastest");
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  const handleOptimize = async (mode?: OptimizationMode) => {
    setOptimizing(true);
    setMenuOpen(false);
    await optimizeRoute(mode ?? selectedMode);
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
  const skippedCount = stops.filter((s) => s.status === "skipped").length;
  const allDone = stops.length > 0 && visitedCount + skippedCount === stops.length;

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
            <div className="absolute right-0 top-10 z-10 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
              <div className="px-3 py-1.5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Optimize mode</p>
                {OPTIMIZATION_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setSelectedMode(m.value); handleOptimize(m.value); }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50 mt-0.5",
                      selectedMode === m.value && "bg-blue-50 text-blue-700"
                    )}
                  >
                    <Wand2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">{m.label}</span>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
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
          onClick={() => handleOptimize()}
          disabled={optimizing}
          className="mb-4 w-full"
        >
          {optimizing ? <Spinner /> : <Wand2 className="h-4 w-4" />}
          Optimize Route
        </Button>
      )}

      {/* Summary stats */}
      {stops.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-lg font-bold text-green-600">{visitedCount}</p>
            <p className="text-xs text-gray-500">Visited</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-lg font-bold text-gray-400">{skippedCount}</p>
            <p className="text-xs text-gray-500">Skipped</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-lg font-bold text-blue-600">
              {stops.filter((s) => s.status === "pending").length}
            </p>
            <p className="text-xs text-gray-500">Remaining</p>
          </div>
        </div>
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

            const lat = contact.latitude;
            const lng = contact.longitude;
            const encodedAddr = address ? encodeURIComponent(address) : "";
            const googleUrl = address ? `https://www.google.com/maps/dir/?api=1&destination=${encodedAddr}` : null;
            const appleUrl = lat && lng ? `maps://maps.apple.com/?daddr=${lat},${lng}` : null;
            const wazeUrl = lat && lng ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : null;

            const isExpanded = expandedStop === stop.id;

            return (
              <div key={stop.id}>
                <DrivingStop
                  index={index}
                  name={name}
                  address={address || undefined}
                  phone={contact.phone || contact.mobile || undefined}
                  status={stop.status}
                  priority={stop.priority as StopPriority}
                  timeWindowStart={stop.time_window_start}
                  timeWindowEnd={stop.time_window_end}
                  expectedDurationMin={stop.expected_duration_min}
                  onStatusChange={(s) => updateStopStatus(stop.id, s)}
                  onToggleExpand={() => setExpandedStop(isExpanded ? null : stop.id)}
                  expanded={isExpanded}
                />

                {/* Expanded: edit meta */}
                {isExpanded && (
                  <div className="mx-1 rounded-b-xl border border-t-0 border-gray-200 bg-gray-50 p-3 space-y-3">
                    {/* Priority */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Priority</label>
                      <div className="flex gap-2">
                        {(["must_visit", "nice_to_visit"] as StopPriority[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => updateStopMeta(stop.id, { priority: p })}
                            className={cn(
                              "flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors",
                              stop.priority === p
                                ? p === "must_visit"
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : "bg-gray-200 text-gray-700 border-gray-200"
                                : "border-gray-200 text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            {p === "must_visit" ? "Must Visit" : "Nice to Visit"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Time window */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Arrive after
                        </label>
                        <input
                          type="time"
                          value={stop.time_window_start?.slice(0, 5) ?? ""}
                          onChange={(e) => updateStopMeta(stop.id, {
                            time_window_start: e.target.value ? `${e.target.value}:00` : null
                          })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Leave by
                        </label>
                        <input
                          type="time"
                          value={stop.time_window_end?.slice(0, 5) ?? ""}
                          onChange={(e) => updateStopMeta(stop.id, {
                            time_window_end: e.target.value ? `${e.target.value}:00` : null
                          })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">
                        Visit duration (min)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={480}
                        value={stop.expected_duration_min ?? 15}
                        onChange={(e) => updateStopMeta(stop.id, {
                          expected_duration_min: parseInt(e.target.value, 10) || 15
                        })}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Visit outcome */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Outcome</label>
                      <select
                        value={stop.visit_outcome ?? ""}
                        onChange={(e) => updateStopMeta(stop.id, { visit_outcome: e.target.value || null })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No outcome</option>
                        <option value="interested">Interested</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="booked">Booked</option>
                        <option value="no_answer">No Answer</option>
                        <option value="left_info">Left Info</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Navigation links */}
                {stop.status === "pending" && (googleUrl || appleUrl) && (
                  <div className="mt-1 flex gap-1.5">
                    {googleUrl && (
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        <Navigation className="h-3 w-3" />
                        Google
                      </a>
                    )}
                    {appleUrl && (
                      <a
                        href={appleUrl}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <MapIcon className="h-3 w-3" />
                        Apple
                      </a>
                    )}
                    {wazeUrl && (
                      <a
                        href={wazeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-purple-200 py-1.5 text-xs text-purple-600 hover:bg-purple-50"
                      >
                        <Navigation className="h-3 w-3" />
                        Waze
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

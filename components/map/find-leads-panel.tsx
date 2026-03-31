"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Route,
  Search,
  Star,
  X,
} from "lucide-react";
import { BUSINESS_TYPE_COLORS } from "@/types";
import type { DiscoveryResult } from "@/app/api/leads/discover/route";

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_COLORS);

const KEYWORD_SUGGESTIONS = [
  "dance studio",
  "gymnastics",
  "cheer",
  "daycare",
  "preschool",
  "elementary school",
  "private school",
  "martial arts",
  "sports club",
  "youth soccer",
  "swim school",
];

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface FindLeadsPanelProps {
  bounds: Bounds | null;
  results: DiscoveryResult[];
  selectedIds: Set<string>;
  searchAreaRequestId: number;
  onClose: () => void;
  onLeadsAdded: () => void;
  onResultsChange: (results: DiscoveryResult[]) => void;
  onSelectedIdsChange: (ids: Set<string>) => void;
  onSearchCompleted: () => void;
}

type ConfirmState =
  | "idle"
  | "route-prompt"          // two-choice screen
  | "new-route-form"        // name + date fields
  | "existing-route-picker"; // list of non-completed routes

interface ExistingRoute {
  id: string;
  name: string;
  status: string;
  planned_date: string | null;
}

function defaultRouteName() {
  return `Route ${new Date().toLocaleDateString()}`;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

async function readResponsePayload(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    const text = await response.text().catch(() => "");
    return {
      error: text || `Request failed (${response.status})`,
    };
  }
}

export function FindLeadsPanel({
  bounds,
  results,
  selectedIds,
  searchAreaRequestId,
  onClose,
  onLeadsAdded,
  onResultsChange,
  onSelectedIdsChange,
  onSearchCompleted,
}: FindLeadsPanelProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const [addingLeads, setAddingLeads] = useState(false);
  // New-route form state
  const [routeName, setRouteName] = useState(defaultRouteName);
  const [routeDate, setRouteDate] = useState(todayIso);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  // Existing-route picker state
  const [existingRoutes, setExistingRoutes] = useState<ExistingRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [addingToRoute, setAddingToRoute] = useState(false);
  const [addedToRouteId, setAddedToRouteId] = useState<string | null>(null);
  // Shared result state
  const [lastAddedCount, setLastAddedCount] = useState(0);
  const [lastAddedCompanyIds, setLastAddedCompanyIds] = useState<string[]>([]);
  const [localAddedIds, setLocalAddedIds] = useState<Set<string>>(new Set());

  const searchAreaRequestRef = useRef(0);

  const inCrmIds = useMemo(() => {
    const ids = new Set<string>();
    for (const result of results) {
      if (result.already_in_crm) ids.add(result.place_id);
    }
    for (const id of localAddedIds) ids.add(id);
    return ids;
  }, [results, localAddedIds]);

  const selectedAddableResults = useMemo(
    () =>
      results.filter(
        (result) => selectedIds.has(result.place_id) && !inCrmIds.has(result.place_id)
      ),
    [results, selectedIds, inCrmIds]
  );

  const selectableResults = useMemo(
    () => results.filter((result) => !inCrmIds.has(result.place_id)),
    [results, inCrmIds]
  );

  const allSelected =
    selectableResults.length > 0 &&
    selectableResults.every((result) => selectedIds.has(result.place_id));

  const runSearch = useCallback(async () => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;
    if (!bounds) {
      setError("Move the map into position first, then search this area.");
      return;
    }

    setLoading(true);
    setError(null);
    setConfirmState("idle");
    setRouteError(null);
    setLastAddedCount(0);
    setLastAddedCompanyIds([]);
    setAddedToRouteId(null);
    onSelectedIdsChange(new Set());

    try {
      const response = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: normalizedKeyword, ...bounds }),
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "Search failed";
        throw new Error(message);
      }

      const nextResults: DiscoveryResult[] = Array.isArray(payload.data)
        ? (payload.data as DiscoveryResult[])
        : [];
      onResultsChange(nextResults);
      onSearchCompleted();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [bounds, keyword, onResultsChange, onSearchCompleted, onSelectedIdsChange]);

  useEffect(() => {
    if (searchAreaRequestId === 0 || searchAreaRequestId === searchAreaRequestRef.current) {
      return;
    }
    searchAreaRequestRef.current = searchAreaRequestId;
    void runSearch();
  }, [searchAreaRequestId, runSearch]);

  const toggleSelected = useCallback(
    (placeId: string) => {
      if (inCrmIds.has(placeId)) return;
      const next = new Set(selectedIds);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      onSelectedIdsChange(next);
    },
    [inCrmIds, onSelectedIdsChange, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectedIdsChange(new Set());
      return;
    }
    onSelectedIdsChange(new Set(selectableResults.map((result) => result.place_id)));
  }, [allSelected, onSelectedIdsChange, selectableResults]);

  const handleConfirmAdd = useCallback(async () => {
    if (selectedAddableResults.length === 0) return;

    setAddingLeads(true);
    setError(null);

    try {
      const response = await fetch("/api/leads/batch-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: selectedAddableResults.map((result) => ({
            place_id: result.place_id,
            name: result.name,
            address: result.address,
            lat: result.lat,
            lng: result.lng,
            phone: result.phone,
            website: result.website,
          })),
          business_type: selectedType,
        }),
      });

      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "Failed to add leads";
        throw new Error(message);
      }

      const added = Number(payload.added ?? 0);
      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const createdIds = contacts
        .map((contact: { id?: string }) => contact.id)
        .filter((id: string | undefined): id is string => Boolean(id));

      setLocalAddedIds((prev) => {
        const next = new Set(prev);
        for (const lead of selectedAddableResults) next.add(lead.place_id);
        return next;
      });

      const newlyProcessed = new Set(selectedAddableResults.map((lead) => lead.place_id));
      onResultsChange(
        results.map((result) =>
          newlyProcessed.has(result.place_id)
            ? { ...result, already_in_crm: true }
            : result
        )
      );

      onSelectedIdsChange(new Set());
      onLeadsAdded();

      setLastAddedCount(added);
      setLastAddedCompanyIds(createdIds);
      setRouteName(defaultRouteName());
      setRouteDate(todayIso());
      setRouteError(null);
      setSelectedRouteId(null);
      setAddedToRouteId(null);

      setConfirmState(added > 0 && createdIds.length > 0 ? "route-prompt" : "idle");
      // Note: createdIds are synced_companies.id UUIDs (not contact IDs)
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to add leads");
      setConfirmState("idle");
    } finally {
      setAddingLeads(false);
    }
  }, [
    onLeadsAdded,
    onResultsChange,
    onSelectedIdsChange,
    results,
    selectedAddableResults,
    selectedType,
  ]);

  // Create a brand-new route with name + date, then navigate or stay
  const handleCreateNewRoute = useCallback(async (navigateAfter: boolean) => {
    if (lastAddedCompanyIds.length === 0 || isCreatingRoute) return;

    setIsCreatingRoute(true);
    setRouteError(null);

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName.trim() || defaultRouteName(),
          planned_date: routeDate || null,
          stop_ids: lastAddedCompanyIds,
        }),
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "Failed to create route";
        throw new Error(message);
      }
      const routeId =
        payload.data && typeof (payload.data as Record<string, unknown>).id === "string"
          ? (payload.data as Record<string, unknown>).id as string
          : null;

      if (navigateAfter && routeId) {
        router.push(`/routes/${routeId}`);
      } else {
        // Stay on map — reset to idle so user can keep searching
        setConfirmState("idle");
        setLastAddedCompanyIds([]);
      }
    } catch (createError) {
      setRouteError(createError instanceof Error ? createError.message : "Failed to create route");
    } finally {
      setIsCreatingRoute(false);
    }
  }, [isCreatingRoute, lastAddedCompanyIds, routeDate, routeName, router]);

  // Load non-completed routes for the picker
  const handleLoadExistingRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const res = await fetch("/api/routes");
      const json = await res.json() as { data?: ExistingRoute[] };
      if (!res.ok) throw new Error("Failed to load routes");
      const nonCompleted = (json.data ?? [])
        .filter((r) => r.status !== "completed")
        .sort((a, b) => {
          if (!a.planned_date && !b.planned_date) return 0;
          if (!a.planned_date) return 1;
          if (!b.planned_date) return -1;
          return a.planned_date.localeCompare(b.planned_date);
        });
      setExistingRoutes(nonCompleted);
      setSelectedRouteId(nonCompleted[0]?.id ?? null);
    } catch {
      setExistingRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  // Append stops to an existing route
  const handleAddToExistingRoute = useCallback(async () => {
    if (!selectedRouteId || lastAddedCompanyIds.length === 0 || addingToRoute) return;

    setAddingToRoute(true);
    setRouteError(null);

    try {
      const response = await fetch(`/api/routes/${selectedRouteId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_ids: lastAddedCompanyIds }),
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "Failed to add stops to route";
        throw new Error(message);
      }
      setAddedToRouteId(selectedRouteId);
    } catch (addError) {
      setRouteError(addError instanceof Error ? addError.message : "Failed to add stops to route");
    } finally {
      setAddingToRoute(false);
    }
  }, [addingToRoute, lastAddedCompanyIds, selectedRouteId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="font-semibold text-gray-900">Find Leads</h2>
          <p className="text-xs text-gray-500">Search businesses in the visible map area</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 border-b border-gray-200 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500">
          <Search className="h-4 w-4 shrink-0 text-pink-600" />
          <input
            type="text"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setShowSuggestions(false);
                void runSearch();
              }
              if (event.key === "Escape") setShowSuggestions(false);
            }}
            placeholder="elementary school, daycare, dance..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {keyword && (
            <button
              onClick={() => {
                setKeyword("");
                setShowSuggestions(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {showSuggestions && (
          <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            <div className="flex flex-wrap gap-1 p-2">
              {KEYWORD_SUGGESTIONS.filter(
                (suggestion) => !keyword || suggestion.toLowerCase().includes(keyword.toLowerCase())
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setKeyword(suggestion);
                    setShowSuggestions(false);
                  }}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-pink-50 hover:text-pink-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setShowSuggestions(false);
            void runSearch();
          }}
          disabled={!keyword.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Searching..." : "Search This View"}
        </button>
      </div>

      {error && (
        <div className="m-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>{results.length} results</span>
          {selectableResults.length > 0 && (
            <button onClick={toggleSelectAll} className="font-medium text-blue-600 hover:text-blue-700">
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <MapPin className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Search to find businesses in this map area</p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {results.map((result) => {
            const selected = selectedIds.has(result.place_id);
            const inCrm = inCrmIds.has(result.place_id);
            return (
              <button
                key={result.place_id}
                onClick={() => toggleSelected(result.place_id)}
                disabled={inCrm}
                className={`w-full p-4 text-left transition-colors ${
                  inCrm
                    ? "cursor-not-allowed bg-gray-50 text-gray-400"
                    : selected
                      ? "bg-blue-50"
                      : "bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <div
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{result.name}</p>
                      {result.address && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{result.address}</p>
                      )}
                    </div>
                  </div>

                  {inCrm && (
                    <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                      In CRM
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                  {result.rating != null && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {result.rating.toFixed(1)}
                      {result.user_ratings_total != null && (
                        <span className="ml-0.5 text-gray-300">({result.user_ratings_total})</span>
                      )}
                    </span>
                  )}
                  {result.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />
                      {result.phone}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Route-prompt: two-choice screen ── */}
      {confirmState === "route-prompt" && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">
            {lastAddedCount} lead{lastAddedCount !== 1 ? "s" : ""} added to CRM.
          </p>
          <p className="text-xs text-gray-500">Add them to a route?</p>
          <button
            onClick={() => setConfirmState("new-route-form")}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Create new route</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
          <button
            onClick={() => {
              setConfirmState("existing-route-picker");
              void handleLoadExistingRoutes();
            }}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Add to existing route</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
          <button
            onClick={() => setConfirmState("idle")}
            className="text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
        </div>
      )}

      {/* ── New-route form ── */}
      {confirmState === "new-route-form" && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmState("route-prompt")}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-gray-900">New route</p>
          </div>
          <div className="space-y-2">
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Route name"
            />
            <input
              type="date"
              value={routeDate}
              onChange={(e) => setRouteDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          {routeError && <p className="text-xs text-red-600">{routeError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreateNewRoute(true)}
              disabled={isCreatingRoute}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreatingRoute ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save & Open"}
            </button>
            <button
              onClick={() => void handleCreateNewRoute(false)}
              disabled={isCreatingRoute}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save & Stay
            </button>
          </div>
        </div>
      )}

      {/* ── Existing-route picker ── */}
      {confirmState === "existing-route-picker" && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmState("route-prompt")}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-gray-900">Add to route</p>
          </div>

          {loadingRoutes && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {!loadingRoutes && existingRoutes.length === 0 && (
            <p className="text-xs text-gray-500">No planned or in-progress routes found.</p>
          )}

          {!loadingRoutes && existingRoutes.length > 0 && !addedToRouteId && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {existingRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selectedRouteId === route.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{route.name}</p>
                    <p className="text-xs text-gray-500">
                      {route.status === "in_progress" ? "In Progress" : "Planned"}
                      {route.planned_date && ` · ${new Date(route.planned_date + "T12:00:00").toLocaleDateString()}`}
                    </p>
                  </div>
                  {selectedRouteId === route.id && (
                    <Check className="h-4 w-4 shrink-0 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* After successfully adding — show Open / Stay options */}
          {addedToRouteId && (
            <div className="space-y-2">
              <p className="text-xs text-green-700">
                <Check className="mr-1 inline h-3 w-3" />
                Stops added successfully.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/routes/${addedToRouteId}`)}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Open Route
                </button>
                <button
                  onClick={() => { setConfirmState("idle"); setLastAddedCompanyIds([]); }}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Stay on Map
                </button>
              </div>
            </div>
          )}

          {routeError && <p className="text-xs text-red-600">{routeError}</p>}

          {!addedToRouteId && !loadingRoutes && existingRoutes.length > 0 && (
            <button
              onClick={() => void handleAddToExistingRoute()}
              disabled={!selectedRouteId || addingToRoute}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addingToRoute ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {addingToRoute ? "Adding..." : "Add to Selected Route"}
            </button>
          )}
        </div>
      )}

      {confirmState === "idle" && selectedAddableResults.length > 0 && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <div>
            <label htmlFor="business-type-select" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Business type
            </label>
            <select
              id="business-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            >
              <option value="">— Select type (optional) —</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void handleConfirmAdd()}
            disabled={addingLeads}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
          >
            {addingLeads ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {addingLeads
              ? "Adding leads..."
              : `Confirm & Add ${selectedAddableResults.length} Leads`}
          </button>
        </div>
      )}
    </div>
  );
}

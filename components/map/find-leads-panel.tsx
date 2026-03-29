"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  MapPin,
  Phone,
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

type ConfirmState = "idle" | "route-prompt";

function defaultRouteName() {
  return `Route ${new Date().toLocaleDateString()}`;
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
  const [keyword, setKeyword] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const [addingLeads, setAddingLeads] = useState(false);
  const [routeName, setRouteName] = useState(defaultRouteName);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeCreated, setRouteCreated] = useState(false);
  const [lastAddedCount, setLastAddedCount] = useState(0);
  const [lastAddedContactIds, setLastAddedContactIds] = useState<string[]>([]);
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
    setRouteCreated(false);
    setRouteError(null);
    setLastAddedCount(0);
    setLastAddedContactIds([]);
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

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((value) => value !== type) : [...prev, type]
    );
  }, []);

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
          business_type: selectedTypes,
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
      setLastAddedContactIds(createdIds);
      setRouteName(defaultRouteName());
      setRouteError(null);
      setRouteCreated(false);

      setConfirmState(added > 0 && createdIds.length > 0 ? "route-prompt" : "idle");
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
    selectedTypes,
  ]);

  const handleCreateRoute = useCallback(async () => {
    if (lastAddedContactIds.length === 0 || isCreatingRoute) return;

    setIsCreatingRoute(true);
    setRouteError(null);
    setRouteCreated(false);

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName.trim() || defaultRouteName(),
          stop_ids: lastAddedContactIds,
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
      setRouteCreated(true);
    } catch (createError) {
      setRouteError(createError instanceof Error ? createError.message : "Failed to create route");
    } finally {
      setIsCreatingRoute(false);
    }
  }, [isCreatingRoute, lastAddedContactIds, routeName]);

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
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400">
          <Search className="h-4 w-4 shrink-0 text-orange-500" />
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
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700"
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
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
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

      {confirmState === "route-prompt" && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">{lastAddedCount} leads added to CRM.</p>
          <p className="text-xs text-gray-500">
            {routeCreated
              ? "Route created. Create another route with these leads?"
              : "Create a route with these leads?"}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={routeName}
              onChange={(event) => setRouteName(event.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="Route name"
            />
            <button
              onClick={() => void handleCreateRoute()}
              disabled={isCreatingRoute}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreatingRoute ? "Saving..." : "Save"}
            </button>
          </div>
          {routeError && <p className="text-xs text-red-600">{routeError}</p>}
          <button
            onClick={() => setConfirmState("idle")}
            className="text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
        </div>
      )}

      {confirmState === "idle" && selectedAddableResults.length > 0 && (
        <div className="space-y-3 border-t border-gray-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    selectedTypes.includes(type)
                      ? "border-transparent text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                  style={
                    selectedTypes.includes(type)
                      ? { backgroundColor: BUSINESS_TYPE_COLORS[type] }
                      : undefined
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void handleConfirmAdd()}
            disabled={addingLeads}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
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

"use client";

import { useState, useCallback, memo } from "react";
import {
  X,
  Search,
  MapPin,
  Star,
  Phone,
  Globe,
  Plus,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { BUSINESS_TYPE_COLORS } from "@/types";
import type { DiscoveryResult } from "@/app/api/leads/discover/route";

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_COLORS);

// Radius options: label → meters
const RADIUS_OPTIONS = [
  { label: "1 mi", value: 1609 },
  { label: "3 mi", value: 4828 },
  { label: "5 mi", value: 8047 },
  { label: "10 mi", value: 16093 },
  { label: "20 mi", value: 32187 },
];

// Keyword suggestions for the search field
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

interface DiscoverPanelProps {
  /** Current map center — used as default search center */
  center: { lat: number; lng: number };
  onClose: () => void;
  /** Called after a lead is added so the map can refetch contacts */
  onLeadAdded: () => void;
  /** Called to highlight discovery pins on the map */
  onResultsChange: (results: DiscoveryResult[]) => void;
}

type AddState = "idle" | "adding" | "added" | "error" | "duplicate";

interface ResultState {
  state: AddState;
  selectedTypes: string[];
}

export const DiscoverPanel = memo(function DiscoverPanel({
  center,
  onClose,
  onLeadAdded,
  onResultsChange,
}: DiscoverPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(8047); // 5 mi default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [resultStates, setResultStates] = useState<Record<string, ResultState>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingAll, setAddingAll] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setResultStates({});
    onResultsChange([]);

    try {
      const res = await fetch("/api/leads/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          radius: radiusMeters,
          keyword: keyword.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");

      const data: DiscoveryResult[] = json.data ?? [];
      setResults(data);
      onResultsChange(data);

      // Pre-mark already-in-CRM results
      const initial: Record<string, ResultState> = {};
      for (const r of data) {
        initial[r.place_id] = {
          state: r.already_in_crm ? "duplicate" : "idle",
          selectedTypes: [],
        };
      }
      setResultStates(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [keyword, radiusMeters, center, onResultsChange]);

  const toggleType = (placeId: string, type: string) => {
    setResultStates((prev) => {
      const cur = prev[placeId] ?? { state: "idle", selectedTypes: [] };
      const types = cur.selectedTypes.includes(type)
        ? cur.selectedTypes.filter((t) => t !== type)
        : [...cur.selectedTypes, type];
      return { ...prev, [placeId]: { ...cur, selectedTypes: types } };
    });
  };

  const handleAdd = useCallback(
    async (result: DiscoveryResult) => {
      const state = resultStates[result.place_id];
      if (!state || state.state === "adding" || state.state === "added") return;

      setResultStates((prev) => ({
        ...prev,
        [result.place_id]: { ...prev[result.place_id], state: "adding" },
      }));

      try {
        const res = await fetch("/api/leads/add-from-discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: result.place_id,
            name: result.name,
            address: result.address,
            lat: result.lat,
            lng: result.lng,
            phone: result.phone,
            website: result.website,
            business_type: state.selectedTypes,
          }),
        });
        const json = await res.json();
        if (res.status === 409) {
          setResultStates((prev) => ({
            ...prev,
            [result.place_id]: { ...prev[result.place_id], state: "duplicate" },
          }));
          return;
        }
        if (!res.ok) throw new Error(json.error || "Failed to add");

        setResultStates((prev) => ({
          ...prev,
          [result.place_id]: { ...prev[result.place_id], state: "added" },
        }));
        onLeadAdded();
      } catch {
        setResultStates((prev) => ({
          ...prev,
          [result.place_id]: { ...prev[result.place_id], state: "error" },
        }));
      }
    },
    [resultStates, onLeadAdded]
  );

  const handleAddAll = useCallback(async () => {
    const toAdd = results.filter((r) => {
      const s = resultStates[r.place_id];
      return s && s.state === "idle";
    });
    if (toAdd.length === 0) return;

    setAddingAll(true);
    await Promise.allSettled(toAdd.map((r) => handleAdd(r)));
    setAddingAll(false);
  }, [results, resultStates, handleAdd]);

  const addableCount = results.filter((r) => resultStates[r.place_id]?.state === "idle").length;
  const addedCount = results.filter(
    (r) => resultStates[r.place_id]?.state === "added"
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="font-semibold text-gray-900">Discover Leads</h2>
          <p className="text-xs text-gray-500">
            Search nearby businesses to add to CRM
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search form */}
      <div className="border-b border-gray-200 p-4 space-y-3">
        {/* Keyword input */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400">
            <Search className="h-4 w-4 shrink-0 text-orange-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                  handleSearch();
                }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="dance studio, daycare, school…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            {keyword && (
              <button
                onClick={() => { setKeyword(""); setShowSuggestions(false); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {KEYWORD_SUGGESTIONS.filter((s) =>
                !keyword || s.toLowerCase().includes(keyword.toLowerCase())
              ).map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setKeyword(s);
                    setShowSuggestions(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50"
                >
                  <Search className="h-3 w-3 text-gray-400" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Radius selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 shrink-0">Radius:</span>
          <div className="flex gap-1 flex-wrap">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRadiusMeters(opt.value)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  radiusMeters === opt.value
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={() => { setShowSuggestions(false); handleSearch(); }}
          disabled={!keyword.trim() || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="border-b border-gray-100 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {results.length} results
              {addedCount > 0 && ` · ${addedCount} added`}
            </span>
            {addableCount > 0 && (
              <button
                onClick={handleAddAll}
                disabled={addingAll}
                className="flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
              >
                {addingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Add all ({addableCount})
              </button>
            )}
          </div>
        )}

        {results.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <MapPin className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">
              Search for business types near the current map center
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {results.map((result) => {
            const rs = resultStates[result.place_id] ?? { state: "idle", selectedTypes: [] };
            const isAdded = rs.state === "added";
            const isDuplicate = rs.state === "duplicate";
            const isAdding = rs.state === "adding";
            const isError = rs.state === "error";

            return (
              <div
                key={result.place_id}
                className={`p-4 transition-colors ${
                  isAdded ? "bg-green-50" : isDuplicate ? "bg-gray-50" : "bg-white"
                }`}
              >
                {/* Name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {result.name}
                    </p>
                    {result.address && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {result.address}
                      </p>
                    )}
                  </div>
                  {isAdded && (
                    <span className="shrink-0 flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle className="h-3.5 w-3.5" /> Added
                    </span>
                  )}
                  {isDuplicate && (
                    <span className="shrink-0 text-xs text-gray-400">In CRM</span>
                  )}
                </div>

                {/* Rating + meta */}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                  {result.rating != null && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      {result.rating.toFixed(1)}
                      {result.user_ratings_total != null && (
                        <span className="ml-0.5 text-gray-300">
                          ({result.user_ratings_total})
                        </span>
                      )}
                    </span>
                  )}
                  {result.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />
                      {result.phone}
                    </span>
                  )}
                  {result.website && (
                    <a
                      href={result.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 hover:text-orange-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe className="h-3 w-3" />
                      website
                    </a>
                  )}
                </div>

                {/* Business type selector + add button (only for not-yet-added) */}
                {!isAdded && !isDuplicate && (
                  <div className="mt-2.5 space-y-2">
                    {/* Type chips */}
                    <div className="flex flex-wrap gap-1">
                      {BUSINESS_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleType(result.place_id, type)}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                            rs.selectedTypes.includes(type)
                              ? "text-white border-transparent"
                              : "text-gray-400 border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                          style={
                            rs.selectedTypes.includes(type)
                              ? { backgroundColor: BUSINESS_TYPE_COLORS[type] }
                              : undefined
                          }
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => handleAdd(result)}
                      disabled={isAdding}
                      className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {isAdding ? "Adding…" : "Add to CRM"}
                    </button>

                    {isError && (
                      <p className="text-xs text-red-500">Failed — tap to retry</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

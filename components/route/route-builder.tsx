"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Save, X, ListPlus, FileUp } from "lucide-react";
import { GoogleMapView } from "@/components/map/google-map";
import { FilterPanel } from "@/components/map/filter-panel";
import { SearchBar } from "@/components/map/search-bar";
import { StopList } from "@/components/route/stop-list";
import { RouteStats } from "@/components/route/route-stats";
import { ImportStopsModal } from "@/components/route/import-stops-modal";
import { Button, Input, Spinner } from "@/components/ui";
import { useContacts, useFilters } from "@/lib/hooks";
import { useMapSettings } from "@/lib/hooks/use-map-settings";
import { useRouteBuilder } from "@/lib/hooks/use-route-builder";
import type { ContactMarkerData } from "@/types";

export function RouteBuilder() {
  const router = useRouter();
  const { markers, loading } = useContacts();
  const { filters, filtered, updateFilter, resetFilters, activeFilterCount } =
    useFilters(markers);
  const { settings } = useMapSettings();
  const {
    stops,
    routeName,
    setRouteName,
    addStop,
    removeStop,
    moveStop,
    hasStop,
    addMultipleStops,
  } = useRouteBuilder();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const handleMarkerClick = useCallback(
    (contact: ContactMarkerData) => {
      setSelectedId(contact.id);
      addStop(contact);
    },
    [addStop]
  );

  const handleSave = async () => {
    if (!routeName.trim() || stops.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName.trim(),
          stop_ids: stops.map((s) => s.contact.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/routes/${json.data.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel: stop list + controls */}
      {panelOpen && (
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Route Builder</h2>
            <button
              onClick={() => setPanelOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Route name + bulk add */}
          <div className="border-b border-gray-100 px-4 py-3 space-y-2">
            <Input
              placeholder="Route name…"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2">
              {filtered.length > 0 && (
                <button
                  onClick={() => {
                    if (filtered.length > 50) {
                      if (!window.confirm(`Add all ${filtered.length} filtered contacts to route?`)) return;
                    }
                    addMultipleStops(filtered);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Add all ({filtered.length})
                </button>
              )}
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileUp className="h-3.5 w-3.5" />
                Import
              </button>
            </div>
          </div>

          {/* Stop list */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <StopList
              stops={stops}
              onMove={moveStop}
              onRemove={removeStop}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            {stops.length > 0 && (
              <RouteStats
                stopCount={stops.length}
              />
            )}
            <Button
              onClick={handleSave}
              disabled={!routeName.trim() || stops.length === 0 || saving}
              className="w-full"
            >
              {saving ? <Spinner /> : <Save className="h-4 w-4" />}
              Save Route
            </Button>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="relative flex-1">
        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 sm:top-4 sm:left-4 sm:right-4">
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
            >
              <Wand2 className="h-4 w-4" />
              {stops.length} stops
            </button>
          )}
          <SearchBar
            contacts={markers}
            onSelect={handleMarkerClick}
            value={filters.search}
            onChange={(v) => updateFilter("search", v)}
            className="flex-1"
          />
        </div>

        {/* Hint */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white shadow-lg">
          Tap a contact to add it to your route
        </div>

        <GoogleMapView
          contacts={filtered}
          onMarkerClick={handleMarkerClick}
          selectedId={selectedId}
          settings={settings}
        />
      </div>

      {importOpen && (
        <ImportStopsModal
          onClose={() => setImportOpen(false)}
          onImport={(contacts) => addMultipleStops(contacts)}
        />
      )}
    </div>
  );
}

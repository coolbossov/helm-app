"use client";

import { useState, useCallback } from "react";
import { Filter } from "lucide-react";
import { GoogleMapView } from "@/components/map/google-map";
import { FilterPanel } from "@/components/map/filter-panel";
import { ContactDetail } from "@/components/map/contact-detail";
import { SearchBar } from "@/components/map/search-bar";
import { MapStats } from "@/components/map/map-stats";
import { MapSettingsButton } from "@/components/map/map-settings";
import { CoverageLegend } from "@/components/map/coverage-legend";
import { BottomSheet, Spinner } from "@/components/ui";
import { useContacts, useFilters } from "@/lib/hooks";
import { useMapSettings } from "@/lib/hooks/use-map-settings";
import { useCoverage } from "@/lib/hooks/use-coverage";
import type { ContactMarkerData } from "@/types";

export default function MapPage() {
  const { markers, loading, error } = useContacts();
  const { filters, filtered, updateFilter, resetFilters, activeFilterCount } =
    useFilters(markers);
  const { settings, updateSetting } = useMapSettings();
  const { coverageMap } = useCoverage(settings.coverageOverlay);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const handleMarkerClick = useCallback((contact: ContactMarkerData) => {
    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, []);

  const handleSearchSelect = useCallback((contact: ContactMarkerData) => {
    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setMobileDetailOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading contacts…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-gray-500">
            Make sure you've synced contacts from Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      {/* Desktop filter panel */}
      {filterOpen && (
        <div className="hidden w-[280px] shrink-0 border-r border-gray-200 sm:block">
          <FilterPanel
            filters={filters}
            onUpdate={updateFilter}
            onReset={resetFilters}
            activeCount={activeFilterCount}
            onClose={() => setFilterOpen(false)}
          />
        </div>
      )}

      {/* Map area */}
      <div className="relative flex-1">
        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 sm:top-4 sm:left-4 sm:right-4">
          {/* Filter toggle */}
          <button
            onClick={() => {
              if (window.innerWidth < 640) {
                setMobileFilterOpen(true);
              } else {
                setFilterOpen((v) => !v);
              }
            }}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 text-gray-600" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Search */}
          <SearchBar
            contacts={markers}
            onSelect={handleSearchSelect}
            value={filters.search}
            onChange={(v) => updateFilter("search", v)}
            className="flex-1"
          />

          {/* Map settings */}
          <MapSettingsButton settings={settings} onChange={updateSetting} />
        </div>

        {/* Stats badge */}
        <div className="absolute bottom-20 left-3 z-10 rounded-lg bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm sm:bottom-4 sm:left-4">
          <MapStats total={markers.length} visible={filtered.length} />
        </div>

        {/* Coverage legend */}
        {settings.coverageOverlay && (
          <div className="absolute bottom-20 right-3 z-10 sm:bottom-4 sm:right-4">
            <CoverageLegend />
          </div>
        )}

        {/* Google Map */}
        <GoogleMapView
          contacts={filtered}
          onMarkerClick={handleMarkerClick}
          selectedId={selectedId}
          settings={settings}
          coverageMap={coverageMap}
        />

        {/* Empty state when filters produce 0 results */}
        {filtered.length === 0 && markers.length > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl bg-white/90 px-5 py-3 shadow backdrop-blur-sm">
              <p className="text-sm font-medium text-gray-700">No contacts match your filters</p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop detail panel */}
      {selectedId && (
        <div className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white sm:block">
          <ContactDetail contactId={selectedId} onClose={handleCloseDetail} />
        </div>
      )}

      {/* Mobile filter bottom sheet */}
      <BottomSheet
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filters"
        size="full"
      >
        <FilterPanel
          filters={filters}
          onUpdate={updateFilter}
          onReset={resetFilters}
          activeCount={activeFilterCount}
        />
      </BottomSheet>

      {/* Mobile detail bottom sheet */}
      <BottomSheet
        open={mobileDetailOpen && !!selectedId}
        onClose={handleCloseDetail}
        size="half"
      >
        <ContactDetail contactId={selectedId} onClose={handleCloseDetail} />
      </BottomSheet>
    </div>
  );
}

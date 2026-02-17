"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Filter, Wand2 } from "lucide-react";
import { GoogleMapView } from "@/components/map/google-map";
import { FilterPanel } from "@/components/map/filter-panel";
import { ContactDetail } from "@/components/map/contact-detail";
import { SearchBar } from "@/components/map/search-bar";
import { MapStats } from "@/components/map/map-stats";
import { MapSettingsButton } from "@/components/map/map-settings";
import { CoverageLegend } from "@/components/map/coverage-legend";
import { PlacesSearchBar } from "@/components/map/places-search-bar";
import { AddPlaceModal } from "@/components/map/add-place-modal";
import { BottomSheet, Spinner } from "@/components/ui";
import { useContacts, useFilters } from "@/lib/hooks";
import { useMapSettings } from "@/lib/hooks/use-map-settings";
import { useCoverage } from "@/lib/hooks/use-coverage";
import { usePlacesSearch } from "@/lib/hooks/use-places-search";
import { contactsInCorridor } from "@/lib/utils/geo";
import type { ContactMarkerData } from "@/types";

interface LatLng {
  lat: number;
  lng: number;
}

export default function MapPage() {
  const router = useRouter();
  const { markers, loading, error, refetch } = useContacts();
  const { filters, filtered, updateFilter, resetFilters, activeFilterCount } =
    useFilters(markers);
  const { settings, updateSetting } = useMapSettings();
  const { coverageMap } = useCoverage(settings.coverageOverlay);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Auto-plan state
  const [autoPlanActive, setAutoPlanActive] = useState(false);
  const [autoPlanStart, setAutoPlanStart] = useState<LatLng | null>(null);
  const [autoPlanEnd, setAutoPlanEnd] = useState<LatLng | null>(null);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);

  // Places search state
  const [placesMode, setPlacesMode] = useState(false);
  const { results: placeResults, search: searchPlaces, clear: clearPlaces, loading: placesLoading } = usePlacesSearch();
  const [selectedPlace, setSelectedPlace] = useState<{ place_id: string; name: string; lat: number; lng: number; formatted_address?: string; phone?: string } | null>(null);

  const handleMarkerClick = useCallback((contact: ContactMarkerData) => {
    // Don't select contacts when in auto-plan mode (let map clicks go to auto-plan handler)
    if (autoPlanActive) return;
    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, [autoPlanActive]);

  const handleSearchSelect = useCallback((contact: ContactMarkerData) => {
    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setMobileDetailOpen(false);
  }, []);

  // Auto-plan: handle map clicks
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!autoPlanActive) return;
      if (!autoPlanStart) {
        setAutoPlanStart({ lat, lng });
      } else if (!autoPlanEnd) {
        setAutoPlanEnd({ lat, lng });
      }
    },
    [autoPlanActive, autoPlanStart, autoPlanEnd]
  );

  // Auto-plan: trigger when both pins are set
  const handleAutoPlan = useCallback(async () => {
    if (!autoPlanStart || !autoPlanEnd) return;
    setAutoPlanLoading(true);
    try {
      const corridor = contactsInCorridor(filtered, autoPlanStart, autoPlanEnd, 8);
      if (corridor.length === 0) {
        alert("No contacts found in this corridor. Try a wider area.");
        return;
      }
      // Create route
      const name = `Auto-route ${new Date().toLocaleDateString()}`;
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stop_ids: corridor.map((c) => c.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const routeId = json.data.id;
      // Optimize
      await fetch(`/api/routes/${routeId}/optimize`, { method: "POST" });
      // Navigate to route
      router.push(`/routes/${routeId}`);
    } catch (e) {
      console.error("Auto-plan failed:", e);
    } finally {
      setAutoPlanLoading(false);
      setAutoPlanActive(false);
      setAutoPlanStart(null);
      setAutoPlanEnd(null);
    }
  }, [autoPlanStart, autoPlanEnd, filtered, router]);

  // Trigger auto-plan when end pin is set
  const handleMapClickWrapper = useCallback(
    (lat: number, lng: number) => {
      if (!autoPlanActive) return;
      if (!autoPlanStart) {
        setAutoPlanStart({ lat, lng });
      } else {
        setAutoPlanEnd({ lat, lng });
        // Trigger auto-plan after setting end
        setTimeout(() => handleAutoPlan(), 100);
      }
    },
    [autoPlanActive, autoPlanStart, handleAutoPlan]
  );

  const toggleAutoPlan = () => {
    if (autoPlanActive) {
      setAutoPlanActive(false);
      setAutoPlanStart(null);
      setAutoPlanEnd(null);
    } else {
      setAutoPlanActive(true);
      setSelectedId(null);
    }
  };

  const togglePlacesMode = () => {
    setPlacesMode((v) => !v);
    if (placesMode) clearPlaces();
  };

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

          {/* Auto-plan toggle */}
          <button
            onClick={toggleAutoPlan}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors ${
              autoPlanActive
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
            title="Auto-plan route"
          >
            <Wand2 className="h-4 w-4" />
          </button>

          {/* Map settings */}
          <MapSettingsButton settings={settings} onChange={updateSetting} />
        </div>

        {/* Auto-plan hint banner */}
        {autoPlanActive && (
          <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-lg sm:top-[72px]">
            {autoPlanLoading
              ? "Building route…"
              : !autoPlanStart
                ? "Click map to set start point"
                : "Click map to set end point"}
          </div>
        )}

        {/* Places search bar */}
        {placesMode && (
          <div className="absolute top-16 left-3 right-3 z-10 sm:top-[72px] sm:left-4 sm:right-4">
            <PlacesSearchBar onSearch={searchPlaces} loading={placesLoading} />
          </div>
        )}

        {/* Stats badge + Places toggle */}
        <div className="absolute bottom-20 left-3 z-10 flex items-center gap-2 sm:bottom-4 sm:left-4">
          <div className="rounded-lg bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <MapStats total={markers.length} visible={filtered.length} />
          </div>
          <button
            onClick={togglePlacesMode}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors ${
              placesMode
                ? "bg-orange-500 text-white"
                : "bg-white/90 text-gray-600 hover:bg-white"
            }`}
          >
            {placesMode ? "Hide Places" : "Search Places"}
          </button>
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
          onMapClick={autoPlanActive ? handleMapClickWrapper : undefined}
          autoPlanPins={
            autoPlanActive
              ? { start: autoPlanStart ?? undefined, end: autoPlanEnd ?? undefined }
              : undefined
          }
          placeMarkers={placeResults}
          onPlaceClick={(place) => setSelectedPlace(place)}
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

      {/* Add Place to CRM modal */}
      {selectedPlace && (
        <AddPlaceModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onAdded={() => {
            setSelectedPlace(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

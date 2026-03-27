"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Filter, Route, Telescope } from "lucide-react";
import { GoogleMapView } from "@/components/map/google-map";
import { FilterPanel } from "@/components/map/filter-panel";
import { ContactDetail } from "@/components/map/contact-detail";
import { SearchBar } from "@/components/map/search-bar";
import { MapStats } from "@/components/map/map-stats";
import { MapSettingsButton } from "@/components/map/map-settings";
import { CoverageLegend } from "@/components/map/coverage-legend";
import { VisitStatusLegend } from "@/components/map/visit-status-legend";
import { RouteBuilder } from "@/components/map/route-builder";
import { DiscoverPanel } from "@/components/map/discover-panel";
import { BottomSheet, Spinner } from "@/components/ui";
import { useContacts, useFilters } from "@/lib/hooks";
import { useMapSettings } from "@/lib/hooks/use-map-settings";
import { contactsInCorridor } from "@/lib/utils/geo";
import { SA_CENTER } from "@/types/maps";
import type { ContactMarkerData } from "@/types";
import type { DiscoveryResult } from "@/app/api/leads/discover/route";

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Auto-plan state
  const [autoPlanActive, setAutoPlanActive] = useState(false);
  const [autoPlanStart, setAutoPlanStart] = useState<LatLng | null>(null);
  const [autoPlanEnd, setAutoPlanEnd] = useState<LatLng | null>(null);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);

  // Discover panel state
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverMobileOpen, setDiscoverMobileOpen] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [mapCenter, setMapCenter] = useState(SA_CENTER);

  // Route builder state
  const [routeBuilderOpen, setRouteBuilderOpen] = useState(false);
  const [routeBuilderMobileOpen, setRouteBuilderMobileOpen] = useState(false);
  const [routeStops, setRouteStops] = useState<ContactMarkerData[]>([]);

  const handleMarkerClick = useCallback((contact: ContactMarkerData) => {
    // Auto-plan mode: ignore marker clicks
    if (autoPlanActive) return;

    // Route builder mode: toggle stop in/out
    if (routeBuilderOpen || routeBuilderMobileOpen) {
      setRouteStops((prev) => {
        const exists = prev.find((s) => s.id === contact.id);
        if (exists) return prev.filter((s) => s.id !== contact.id);
        return [...prev, contact];
      });
      return;
    }

    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, [autoPlanActive, routeBuilderOpen, routeBuilderMobileOpen]);

  const handleSearchSelect = useCallback((contact: ContactMarkerData) => {
    setSelectedId(contact.id);
    setMobileDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setMobileDetailOpen(false);
  }, []);

  // Auto-plan: trigger with explicit start/end to avoid stale closure on autoPlanEnd
  const handleAutoPlan = useCallback(async (start: LatLng, end: LatLng) => {
    setAutoPlanLoading(true);
    try {
      const corridor = contactsInCorridor(filtered, start, end, 8);
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
  }, [filtered, router]);

  // Trigger auto-plan when end pin is set — pass coords explicitly to avoid stale closure
  const handleMapClickWrapper = useCallback(
    (lat: number, lng: number) => {
      if (!autoPlanActive) return;
      if (!autoPlanStart) {
        setAutoPlanStart({ lat, lng });
      } else {
        const end = { lat, lng };
        setAutoPlanEnd(end);
        setTimeout(() => handleAutoPlan(autoPlanStart, end), 100);
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

  const openDiscover = () => {
    if (window.innerWidth < 640) {
      setDiscoverMobileOpen(true);
    } else {
      setDiscoverOpen(true);
      setSelectedId(null);
    }
  };

  const closeDiscover = () => {
    setDiscoverOpen(false);
    setDiscoverMobileOpen(false);
    setDiscoveryResults([]);
  };

  // Route builder helpers
  const openRouteBuilder = () => {
    if (window.innerWidth < 640) {
      setRouteBuilderMobileOpen(true);
    } else {
      setRouteBuilderOpen(true);
      setSelectedId(null); // close contact detail on desktop
    }
  };

  const closeRouteBuilder = () => {
    setRouteBuilderOpen(false);
    setRouteBuilderMobileOpen(false);
  };

  const handleRouteReorder = useCallback((from: number, to: number) => {
    if (to < 0 || to >= routeStops.length) return;
    setRouteStops((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, [routeStops.length]);

  const handleAddAllFiltered = useCallback(() => {
    setRouteStops((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const toAdd = filtered.filter((c) => !existingIds.has(c.id));
      return [...prev, ...toAdd];
    });
  }, [filtered]);

  const handleMarkAllVisited = useCallback(async () => {
    await Promise.allSettled(
      routeStops.map((stop) =>
        fetch(`/api/contacts/${stop.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visit_status: "Visited Recently" }),
        })
      )
    );
    refetch();
  }, [routeStops, refetch]);

  const handleSaveRoute = useCallback(async (): Promise<string | null> => {
    if (routeStops.length === 0) return null;
    try {
      const name = `Route ${new Date().toLocaleDateString()}`;
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stop_ids: routeStops.map((s) => s.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const routeId = json.data.id;
      await fetch(`/api/routes/${routeId}/optimize`, { method: "POST" });
      router.push(`/routes/${routeId}`);
      return routeId;
    } catch (e) {
      console.error("Save route failed:", e);
      return null;
    }
  }, [routeStops, router]);

  // IDs of selected route stops for map highlighting
  const routeStopIds = routeStops.map((s) => s.id);

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
            Make sure you&apos;ve synced contacts from Settings.
          </p>
        </div>
      </div>
    );
  }

  const routeBuilderPanel = (
    <RouteBuilder
      stops={routeStops}
      allFiltered={filtered}
      onRemove={(id) => setRouteStops((prev) => prev.filter((s) => s.id !== id))}
      onReorder={handleRouteReorder}
      onAddAll={handleAddAllFiltered}
      onClear={() => setRouteStops([])}
      onClose={closeRouteBuilder}
      onMarkAllVisited={handleMarkAllVisited}
      onSaveRoute={handleSaveRoute}
    />
  );

  // Discovery results as placeMarkers for the map (same shape: place_id, name, lat, lng)
  const discoveryPlaceMarkers = discoveryResults.map((r) => ({
    place_id: r.place_id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
  }));

  const discoverPanel = (
    <DiscoverPanel
      center={mapCenter}
      onClose={closeDiscover}
      onLeadAdded={refetch}
      onResultsChange={setDiscoveryResults}
    />
  );

  return (
    <div className="relative flex h-full">
      {/* Desktop filter panel */}
      {filterOpen && !routeBuilderOpen && !discoverOpen && (
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
            className="relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 shadow-sm hover:bg-gray-50 sm:px-3"
          >
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="hidden text-xs font-medium text-gray-600 sm:inline">Filter</span>
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

          {/* Discover toggle */}
          <button
            onClick={openDiscover}
            className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 shadow-sm transition-colors sm:px-3 ${
              discoverOpen || discoverMobileOpen
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
            title="Discover nearby leads"
          >
            <Telescope className="h-4 w-4" />
            <span className={`hidden text-xs font-medium sm:inline ${
              discoverOpen || discoverMobileOpen ? "text-white" : "text-gray-600"
            }`}>Discover</span>
          </button>

          {/* Route builder toggle */}
          <button
            onClick={openRouteBuilder}
            className={`relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 shadow-sm transition-colors sm:px-3 ${
              routeBuilderOpen || routeBuilderMobileOpen
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
            title="Build a route"
          >
            <Route className="h-4 w-4" />
            <span className={`hidden text-xs font-medium sm:inline ${
              routeBuilderOpen || routeBuilderMobileOpen ? "text-white" : "text-gray-600"
            }`}>Route</span>
            {routeStops.length > 0 && !(routeBuilderOpen || routeBuilderMobileOpen) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {routeStops.length}
              </span>
            )}
          </button>

          {/* Map settings (includes visit colors + auto-plan toggles) */}
          <MapSettingsButton
            settings={settings}
            onChange={updateSetting}
            autoPlanActive={autoPlanActive}
            onToggleAutoPlan={toggleAutoPlan}
          />
        </div>

        {/* Route builder hint banner */}
        {(routeBuilderOpen || routeBuilderMobileOpen) && (
          <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-lg sm:top-[72px]">
            Tap markers to add / remove stops — {routeStops.length} selected
          </div>
        )}

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

        {/* Discover mode hint banner */}
        {(discoverOpen || discoverMobileOpen) && discoveryResults.length > 0 && (
          <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-2 text-xs font-medium text-white shadow-lg sm:top-[72px]">
            {discoveryResults.length} results — orange pins on map
          </div>
        )}

        {/* Stats badge */}
        <div className="absolute bottom-20 left-3 z-10 sm:bottom-4 sm:left-4">
          <div className="rounded-lg bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <MapStats total={markers.length} visible={filtered.length} />
          </div>
        </div>

        {/* Legend: visit status or coverage overlay */}
        {settings.visitColorMode && (
          <div className="absolute bottom-20 right-3 z-10 sm:bottom-4 sm:right-4">
            <VisitStatusLegend />
          </div>
        )}
        {!settings.visitColorMode && settings.coverageOverlay && (
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
          onMapClick={autoPlanActive ? handleMapClickWrapper : undefined}
          autoPlanPins={
            autoPlanActive
              ? { start: autoPlanStart ?? undefined, end: autoPlanEnd ?? undefined }
              : undefined
          }
          placeMarkers={discoveryPlaceMarkers}
          routeStopIds={routeStopIds}
          onCenterChange={setMapCenter}
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

      {/* Desktop discover panel */}
      {discoverOpen && (
        <div className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white sm:block">
          {discoverPanel}
        </div>
      )}

      {/* Desktop route builder panel */}
      {!discoverOpen && routeBuilderOpen && (
        <div className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white sm:block">
          {routeBuilderPanel}
        </div>
      )}

      {/* Desktop detail panel (only when route builder and discover are closed) */}
      {!routeBuilderOpen && !discoverOpen && selectedId && (
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
        open={mobileDetailOpen && !!selectedId && !routeBuilderMobileOpen && !discoverMobileOpen}
        onClose={handleCloseDetail}
        size="half"
      >
        <ContactDetail contactId={selectedId} onClose={handleCloseDetail} />
      </BottomSheet>

      {/* Mobile route builder bottom sheet */}
      <BottomSheet
        open={routeBuilderMobileOpen}
        onClose={closeRouteBuilder}
        title="Route Builder"
        size="full"
      >
        {routeBuilderPanel}
      </BottomSheet>

      {/* Mobile discover bottom sheet */}
      <BottomSheet
        open={discoverMobileOpen}
        onClose={closeDiscover}
        title="Discover Leads"
        size="full"
      >
        {discoverPanel}
      </BottomSheet>
    </div>
  );
}

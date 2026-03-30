"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Filter, Route, Telescope } from "lucide-react";
import { GoogleMapView } from "@/components/map/google-map";
import { SearchBar } from "@/components/map/search-bar";
import { MapStats } from "@/components/map/map-stats";
import { MapSettingsButton } from "@/components/map/map-settings";
import { CoverageLegend } from "@/components/map/coverage-legend";
import { VisitStatusLegend } from "@/components/map/visit-status-legend";
import { BottomSheet, Spinner } from "@/components/ui";
import { useContacts, useFilters } from "@/lib/hooks";
import { useMapSettings } from "@/lib/hooks/use-map-settings";
import { contactsInCorridor } from "@/lib/utils/geo";
import type { ContactMarkerData } from "@/types";
import type { DiscoveryResult } from "@/app/api/leads/discover/route";

/* ─── Fix 8: Dynamic imports for heavy panels ─── */
const FilterPanel = dynamic(() =>
  import("@/components/map/filter-panel").then((m) => ({ default: m.FilterPanel })),
  { loading: () => <div className="p-4"><Spinner /></div> }
);
const ContactDetail = dynamic(() =>
  import("@/components/map/contact-detail").then((m) => ({ default: m.ContactDetail })),
  { loading: () => <div className="p-4"><Spinner /></div> }
);
const RouteBuilder = dynamic(() =>
  import("@/components/map/route-builder").then((m) => ({ default: m.RouteBuilder })),
  { loading: () => <div className="p-4"><Spinner /></div> }
);
const FindLeadsPanel = dynamic(() =>
  import("@/components/map/find-leads-panel").then((m) => ({ default: m.FindLeadsPanel })),
  { loading: () => <div className="p-4"><Spinner /></div> }
);

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

  // Find Leads mode state
  const [findLeadsOpen, setFindLeadsOpen] = useState(false);
  const [findLeadsMobileOpen, setFindLeadsMobileOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveryResult[]>([]);
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<string>>(new Set());
  const [hasSearchedFindLeads, setHasSearchedFindLeads] = useState(false);
  const [searchAreaRequestId, setSearchAreaRequestId] = useState(0);
  const [findLeadsMapMoved, setFindLeadsMapMoved] = useState(false);
  const mapBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(
    null
  );

  const handleBoundsChange = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    mapBoundsRef.current = bounds;
    if (hasSearchedFindLeads) setFindLeadsMapMoved(true);
  }, [hasSearchedFindLeads]);

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

  const openFindLeads = () => {
    // Mutual exclusion: close route builder if open
    closeRouteBuilder();
    if (window.innerWidth < 640) {
      setFindLeadsMobileOpen(true);
    } else {
      setFindLeadsOpen(true);
      setSelectedId(null);
    }
  };

  const closeFindLeads = () => {
    setFindLeadsOpen(false);
    setFindLeadsMobileOpen(false);
    setSearchResults([]);
    setSelectedSearchIds(new Set());
    setHasSearchedFindLeads(false);
    setFindLeadsMapMoved(false);
  };

  // Route builder helpers
  const openRouteBuilder = () => {
    // Mutual exclusion: close find leads if open
    closeFindLeads();
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
    setRouteStops((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

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

  /* ─── Fix 3: Memoize derived arrays passed as props to GoogleMapView ─── */
  const routeStopIds = useMemo(() => routeStops.map((s) => s.id), [routeStops]);

  const searchPins = useMemo(
    () => searchResults.map((r) => ({
      place_id: r.place_id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      selected: selectedSearchIds.has(r.place_id),
      inCrm: r.already_in_crm,
      contact_id: r.contact_id ?? null,
    })),
    [searchResults, selectedSearchIds]
  );

  const autoPlanPins = useMemo(
    () => autoPlanActive
      ? { start: autoPlanStart ?? undefined, end: autoPlanEnd ?? undefined }
      : undefined,
    [autoPlanActive, autoPlanStart, autoPlanEnd]
  );

  const onMapClick = useMemo(
    () => autoPlanActive ? handleMapClickWrapper : undefined,
    [autoPlanActive, handleMapClickWrapper]
  );

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

  const findLeadsPanel = (
    <FindLeadsPanel
      bounds={mapBoundsRef.current}
      results={searchResults}
      selectedIds={selectedSearchIds}
      searchAreaRequestId={searchAreaRequestId}
      onClose={closeFindLeads}
      onLeadsAdded={refetch}
      onResultsChange={(results) => {
        setSearchResults(results);
        setSelectedSearchIds(new Set());
        setHasSearchedFindLeads(true);
      }}
      onSelectedIdsChange={setSelectedSearchIds}
      onSearchCompleted={() => setFindLeadsMapMoved(false)}
    />
  );

  return (
    <div className="relative flex h-full">
      {/* Desktop filter panel */}
      {filterOpen && !routeBuilderOpen && !findLeadsOpen && (
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

          {/* Find Leads toggle */}
          <button
            onClick={openFindLeads}
            className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 shadow-sm transition-colors sm:px-3 ${
              findLeadsOpen || findLeadsMobileOpen
                ? "border-pink-600 bg-pink-600 text-white"
                : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
            title="Find nearby leads"
          >
            <Telescope className="h-4 w-4" />
            <span className={`hidden text-xs font-medium sm:inline ${
              findLeadsOpen || findLeadsMobileOpen ? "text-white" : "text-gray-600"
            }`}>Find Leads</span>
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

        {/* Find Leads mode hint banner */}
        {(findLeadsOpen || findLeadsMobileOpen) && searchResults.length > 0 && (
          <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-pink-600 px-4 py-2 text-xs font-medium text-white shadow-lg sm:top-[72px]">
            {searchResults.length} results — pink pins on map
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
          findLeadsMode={findLeadsOpen || findLeadsMobileOpen}
          onMapClick={onMapClick}
          autoPlanPins={autoPlanPins}
          searchPins={searchPins}
          onSearchPinClick={(placeId) => {
            if (!(findLeadsOpen || findLeadsMobileOpen)) return;
            const target = searchResults.find((result) => result.place_id === placeId);
            if (!target) return;
            // Teal pin (already in CRM) → open existing contact detail
            if (target.already_in_crm && target.contact_id) {
              setSelectedId(target.contact_id);
              setMobileDetailOpen(true);
              return;
            }
            // Pink pin (new lead) → toggle selection
            if (!target.already_in_crm) {
              setSelectedSearchIds((prev) => {
                const next = new Set(prev);
                if (next.has(placeId)) next.delete(placeId);
                else next.add(placeId);
                return next;
              });
            }
          }}
          showSearchAreaButton={(findLeadsOpen || findLeadsMobileOpen) && hasSearchedFindLeads && findLeadsMapMoved}
          onSearchAreaRequest={() => setSearchAreaRequestId((prev) => prev + 1)}
          routeStopIds={routeStopIds}
          onBoundsChange={handleBoundsChange}
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

      {/* Desktop find leads panel */}
      {findLeadsOpen && (
        <div className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white sm:block">
          {findLeadsPanel}
        </div>
      )}

      {/* Desktop route builder panel */}
      {!findLeadsOpen && routeBuilderOpen && (
        <div className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white sm:block">
          {routeBuilderPanel}
        </div>
      )}

      {/* Desktop detail panel (only when route builder and find leads are closed) */}
      {!routeBuilderOpen && !findLeadsOpen && selectedId && (
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

      {/* Mobile detail bottom sheet — hidden on desktop where right sidebar is used */}
      <div className="sm:hidden">
        <BottomSheet
          open={mobileDetailOpen && !!selectedId && !routeBuilderMobileOpen && !findLeadsMobileOpen}
          onClose={handleCloseDetail}
          size="half"
        >
          <ContactDetail contactId={selectedId} onClose={handleCloseDetail} />
        </BottomSheet>
      </div>

      {/* Mobile route builder bottom sheet */}
      <BottomSheet
        open={routeBuilderMobileOpen}
        onClose={closeRouteBuilder}
        title="Route Builder"
        size="full"
      >
        {routeBuilderPanel}
      </BottomSheet>

      {/* Mobile find leads bottom sheet */}
      <BottomSheet
        open={findLeadsMobileOpen}
        onClose={closeFindLeads}
        title="Find Leads"
        size="full"
      >
        {findLeadsPanel}
      </BottomSheet>
    </div>
  );
}

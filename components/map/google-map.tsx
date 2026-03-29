"use client";

import { useRef, useEffect, useMemo, memo } from "react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { useMap } from "@/lib/hooks/use-map";
import {
  BUSINESS_TYPE_COLORS,
  VISIT_STATUS_COLORS,
  getVisitRecencyColor,
  CLUSTER_MAX_ZOOM,
} from "@/types";
import type { ContactMarkerData } from "@/types";
import type { MapSettings } from "@/lib/hooks/use-map-settings";
import { Spinner } from "@/components/ui";

interface AutoPlanPins {
  start?: { lat: number; lng: number };
  end?: { lat: number; lng: number };
}

interface PlaceMarker {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
}

interface GoogleMapViewProps {
  contacts: ContactMarkerData[];
  onMarkerClick: (contact: ContactMarkerData) => void;
  selectedId: string | null;
  settings: MapSettings;
  simplified?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  autoPlanPins?: AutoPlanPins;
  placeMarkers?: PlaceMarker[];
  onPlaceClick?: (place: PlaceMarker) => void;
  routeStopIds?: string[];
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

function getCoverageRing(contact: ContactMarkerData): string {
  return getVisitRecencyColor(contact.last_visit_date);
}

function getMarkerColor(contact: ContactMarkerData, visitColorMode: boolean): string {
  if (visitColorMode) {
    const status = contact.visit_status ?? "Never Visited";
    return VISIT_STATUS_COLORS[status] ?? VISIT_STATUS_COLORS["Never Visited"];
  }
  const type = contact.business_type[0];
  return type ? (BUSINESS_TYPE_COLORS[type] || BUSINESS_TYPE_COLORS.Other) : BUSINESS_TYPE_COLORS.Other;
}

function getMarkerSize(contact: ContactMarkerData): number {
  if (contact.priority === "High Priority" || contact.priority === "Hot Priority") return 14;
  if (contact.priority === "Medium Priority" || contact.priority === "Warm Priority") return 11;
  return 9;
}

function buildContactIcon(
  contact: ContactMarkerData,
  settings: MapSettings,
  selected: boolean
): google.maps.Symbol {
  const fillColor = getMarkerColor(contact, settings.visitColorMode);
  const baseScale = getMarkerSize(contact);
  const scale = selected ? baseScale * 1.45 : baseScale;
  const strokeColor = settings.coverageOverlay ? getCoverageRing(contact) : "#ffffff";
  const strokeWeight = settings.coverageOverlay ? 4 : settings.outlinedMarkers ? 3 : 2;

  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor,
    fillOpacity: 1,
    strokeColor,
    strokeWeight,
    scale,
  };
}

/* ─── Cluster renderer (module-level constant) ─── */
const clusterRenderer = {
  render({ count, position }: { count: number; position: google.maps.LatLng }) {
    const size = Math.min(24 + Math.log2(count) * 8, 56);
    return new google.maps.Marker({
      position,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#2563eb",
        fillOpacity: 0.95,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        scale: size / 2,
      },
      label: {
        text: count > 999 ? `${(count / 1000).toFixed(1)}k` : String(count),
        color: "#ffffff",
        fontWeight: "700",
        fontSize: "12px",
      },
      zIndex: 999,
    });
  },
};

/* ─── Simplified-map CSS filter (module-level constant — Fix 11/12) ─── */
const SIMPLIFIED_STYLE: React.CSSProperties = {
  filter: "grayscale(0.6) brightness(1.08) contrast(0.92)",
};

export const GoogleMapView = memo(function GoogleMapView({
  contacts,
  onMarkerClick,
  selectedId,
  settings,
  onMapClick,
  autoPlanPins,
  placeMarkers,
  onPlaceClick,
  routeStopIds = [],
  onCenterChange,
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, ready, error } = useMap(containerRef);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const markerByIdRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const autoPlanMarkersRef = useRef<google.maps.Marker[]>([]);
  const placeMarkersRef = useRef<google.maps.Marker[]>([]);
  const routeOverlaysRef = useRef<google.maps.Marker[]>([]);
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  /* ─── Fix 6: O(1) contact lookup map ─── */
  const contactById = useMemo(() => {
    const m = new Map<string, ContactMarkerData>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  /* ─── Fix 2: Stable callback ref — effect never depends on onMarkerClick identity ─── */
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  const onPlaceClickRef = useRef(onPlaceClick);
  useEffect(() => { onPlaceClickRef.current = onPlaceClick; }, [onPlaceClick]);

  const onCenterChangeRef = useRef(onCenterChange);
  useEffect(() => { onCenterChangeRef.current = onCenterChange; }, [onCenterChange]);

  /* ─── Fix 1a: Create markers ONLY when contacts change (not on settings/callback change) ─── */
  useEffect(() => {
    if (!map || !ready) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markerByIdRef.current.clear();
    if (clustererRef.current) clustererRef.current.clearMarkers();

    const currentSettings = settings; // capture for initial icon build

    const newMarkers = contacts.map((contact) => {
      const marker = new google.maps.Marker({
        position: { lat: contact.latitude, lng: contact.longitude },
        title: contact.account_name || contact.last_name,
        icon: buildContactIcon(contact, currentSettings, contact.id === selectedIdRef.current),
      });
      marker.addListener("click", () => onMarkerClickRef.current(contact));
      markerByIdRef.current.set(contact.id, marker);
      return marker;
    });

    markersRef.current = newMarkers;

    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      algorithm: new SuperClusterAlgorithm({
        maxZoom: CLUSTER_MAX_ZOOM,
        radius: 80,
      }),
      renderer: clusterRenderer,
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markerByIdRef.current.clear();
      if (clustererRef.current) clustererRef.current.clearMarkers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contacts only; settings handled by style-update effect
  }, [map, ready, contacts]);

  /* ─── Fix 1b: Update marker styles in-place when settings change (no teardown) ─── */
  useEffect(() => {
    if (!map || !ready || markersRef.current.length === 0) return;

    for (const [id, marker] of markerByIdRef.current) {
      const contact = contactById.get(id);
      if (!contact) continue;
      marker.setIcon(buildContactIcon(contact, settings, id === selectedIdRef.current));
    }
    // Force the clusterer to repaint with the updated markers
    if (clustererRef.current) {
      clustererRef.current.render();
    }
  }, [map, ready, settings, contactById]);

  /* ─── Selection highlight — uses O(1) lookup ─── */
  useEffect(() => {
    const prevId = selectedIdRef.current;
    if (prevId) {
      const prevContact = contactById.get(prevId);
      const prevMarker = markerByIdRef.current.get(prevId);
      if (prevContact && prevMarker) {
        prevMarker.setIcon(buildContactIcon(prevContact, settings, false));
        prevMarker.setZIndex(undefined);
      }
    }

    if (selectedId) {
      const nextContact = contactById.get(selectedId);
      const nextMarker = markerByIdRef.current.get(selectedId);
      if (nextContact && nextMarker) {
        nextMarker.setIcon(buildContactIcon(nextContact, settings, true));
        nextMarker.setZIndex(1000);
      }
    }

    selectedIdRef.current = selectedId;
  }, [selectedId, contactById, settings]);

  /* ─── Map click listener ─── */
  useEffect(() => {
    if (!map || !ready) return;
    if (mapClickListenerRef.current) {
      mapClickListenerRef.current.remove();
      mapClickListenerRef.current = null;
    }
    if (onMapClick) {
      mapClickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
      });
    }
    return () => {
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove();
        mapClickListenerRef.current = null;
      }
    };
  }, [map, ready, onMapClick]);

  /* ─── Fix 4 (partial): Center change uses stable ref ─── */
  useEffect(() => {
    if (!map || !ready) return;
    const listener = map.addListener("idle", () => {
      const cb = onCenterChangeRef.current;
      if (!cb) return;
      const c = map.getCenter();
      if (c) cb({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [map, ready]);

  /* ─── Auto-plan pins ─── */
  useEffect(() => {
    if (!map || !ready) return;
    autoPlanMarkersRef.current.forEach((m) => m.setMap(null));
    autoPlanMarkersRef.current = [];
    if (!autoPlanPins) return;

    if (autoPlanPins.start) {
      autoPlanMarkersRef.current.push(
        new google.maps.Marker({
          position: autoPlanPins.start,
          map,
          title: "Start",
          label: { text: "S", color: "#ffffff", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 10,
          },
          zIndex: 1001,
        })
      );
    }

    if (autoPlanPins.end) {
      autoPlanMarkersRef.current.push(
        new google.maps.Marker({
          position: autoPlanPins.end,
          map,
          title: "End",
          label: { text: "E", color: "#ffffff", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#dc2626",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 10,
          },
          zIndex: 1001,
        })
      );
    }

    return () => {
      autoPlanMarkersRef.current.forEach((m) => m.setMap(null));
      autoPlanMarkersRef.current = [];
    };
  }, [map, ready, autoPlanPins]);

  /* ─── Route stop overlays — uses O(1) lookup ─── */
  useEffect(() => {
    if (!map || !ready) return;
    routeOverlaysRef.current.forEach((m) => m.setMap(null));
    routeOverlaysRef.current = [];

    if (routeStopIds.length === 0) return;

    routeOverlaysRef.current = routeStopIds
      .map((id, index) => {
        const contact = contactById.get(id);
        if (!contact) return null;
        return new google.maps.Marker({
          position: { lat: contact.latitude, lng: contact.longitude },
          map,
          clickable: false,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#1d4ed8",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 9,
          },
          label: {
            text: String(index + 1),
            color: "#ffffff",
            fontWeight: "700",
            fontSize: "10px",
          },
          zIndex: 1002,
        });
      })
      .filter((m): m is google.maps.Marker => m !== null);

    return () => {
      routeOverlaysRef.current.forEach((m) => m.setMap(null));
      routeOverlaysRef.current = [];
    };
  }, [map, ready, routeStopIds, contactById]);

  /* ─── Discovery place markers — uses stable ref for callback ─── */
  useEffect(() => {
    if (!map || !ready) return;
    placeMarkersRef.current.forEach((m) => m.setMap(null));
    placeMarkersRef.current = [];

    if (!placeMarkers || placeMarkers.length === 0) return;

    placeMarkersRef.current = placeMarkers.map((place) => {
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        title: place.name,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: "#f97316",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 5,
          rotation: 45,
        },
        zIndex: 1000,
      });
      marker.addListener("click", () => onPlaceClickRef.current?.(place));
      return marker;
    });

    return () => {
      placeMarkersRef.current.forEach((m) => m.setMap(null));
      placeMarkersRef.current = [];
    };
  }, [map, ready, placeMarkers]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100 text-red-600">
        Failed to load Google Maps: {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        style={settings.simplifiedMap ? SIMPLIFIED_STYLE : undefined}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
});

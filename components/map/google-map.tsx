"use client";

import { useRef, useEffect } from "react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { useMap } from "@/lib/hooks/use-map";
import { BUSINESS_TYPE_COLORS, CLUSTER_MAX_ZOOM } from "@/types";
import type { ContactMarkerData } from "@/types";
import type { MapSettings } from "@/lib/hooks/use-map-settings";
import { Spinner } from "@/components/ui";

interface GoogleMapViewProps {
  contacts: ContactMarkerData[];
  onMarkerClick: (contact: ContactMarkerData) => void;
  selectedId: string | null;
  settings: MapSettings;
  coverageMap?: Map<string, Date>;
  simplified?: boolean;
}

function getCoverageRing(contactId: string, coverageMap: Map<string, Date>): string {
  const visited = coverageMap.get(contactId);
  if (!visited) return "#ef4444"; // red — never visited
  const days = (Date.now() - visited.getTime()) / 86400000;
  if (days <= 30) return "#22c55e"; // green
  if (days <= 90) return "#eab308"; // yellow
  return "#ef4444"; // red
}

function getMarkerColor(contact: ContactMarkerData): string {
  const type = contact.business_type[0];
  return type ? (BUSINESS_TYPE_COLORS[type] || BUSINESS_TYPE_COLORS.Other) : BUSINESS_TYPE_COLORS.Other;
}

function getMarkerSize(contact: ContactMarkerData): number {
  if (contact.priority === "High Priority" || contact.priority === "Hot Priority") return 14;
  if (contact.priority === "Medium Priority" || contact.priority === "Warm Priority") return 11;
  return 9;
}

// Option B: SVG teardrop pin
function createPinSVG(color: string, size: number): string {
  const w = size * 2;
  const h = size * 2.6;
  // abbreviation not needed — color already encodes type
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <path
        d="M${w / 2},${h - 2}
           C${w / 2},${h - 2} 2,${h * 0.55}
           2,${w / 2}
           a${w / 2 - 2},${w / 2 - 2} 0 1,1 ${w - 4},0
           C${w - 2},${h * 0.55} ${w / 2},${h - 2} Z"
        fill="${color}"
        stroke="white"
        stroke-width="2"
      />
      <circle cx="${w / 2}" cy="${w / 2}" r="${size * 0.35}" fill="white" opacity="0.7" />
    </svg>
  `;
}

function createCircleMarker(
  contact: ContactMarkerData,
  settings: MapSettings
): HTMLDivElement {
  const color = getMarkerColor(contact);
  const size = getMarkerSize(contact);

  const pin = document.createElement("div");
  pin.style.width = `${size * 2}px`;
  pin.style.height = `${size * 2}px`;
  pin.style.borderRadius = "50%";
  pin.style.backgroundColor = color;
  pin.style.border = "2px solid white";
  pin.style.cursor = "pointer";
  pin.style.transition = "transform 0.15s ease";

  if (settings.outlinedMarkers) {
    pin.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)";
  } else {
    pin.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  }

  return pin;
}

function createPinMarker(contact: ContactMarkerData): HTMLDivElement {
  const color = getMarkerColor(contact);
  const size = getMarkerSize(contact);

  const wrapper = document.createElement("div");
  wrapper.style.cursor = "pointer";
  wrapper.style.transition = "transform 0.15s ease";
  wrapper.innerHTML = createPinSVG(color, size);
  return wrapper;
}

export function GoogleMapView({
  contacts,
  onMarkerClick,
  selectedId,
  settings,
  coverageMap,
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, ready, error } = useMap(containerRef);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const pinElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  // Track zoom for Option A scaling
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  // Build markers when map, contacts, settings, or coverageMap change
  useEffect(() => {
    if (!map || !ready) return;

    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    pinElementsRef.current.clear();
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    if (zoomListenerRef.current) {
      zoomListenerRef.current.remove();
      zoomListenerRef.current = null;
    }

    const newMarkers = contacts.map((contact) => {
      const pin = settings.pinMarkers
        ? createPinMarker(contact)
        : createCircleMarker(contact, settings);

      // Apply coverage ring overlay
      if (settings.coverageOverlay && coverageMap && !settings.pinMarkers) {
        const ringColor = getCoverageRing(contact.id, coverageMap);
        pin.style.boxShadow = `0 0 0 3px ${ringColor}, 0 2px 4px rgba(0,0,0,0.3)`;
      }

      pinElementsRef.current.set(contact.id, pin);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: contact.latitude, lng: contact.longitude },
        content: pin,
        title: contact.account_name || contact.last_name,
      });

      marker.addListener("click", () => onMarkerClick(contact));
      return marker;
    });

    markersRef.current = newMarkers;

    // Reapply selection state
    if (selectedIdRef.current) {
      const pin = pinElementsRef.current.get(selectedIdRef.current);
      if (pin) {
        pin.style.transform = "scale(1.4)";
        pin.style.zIndex = "10";
      }
    }

    // Option A: scale all markers at zoom ≥ 15
    if (settings.outlinedMarkers && !settings.pinMarkers) {
      const applyZoomScale = () => {
        const zoom = map.getZoom() ?? 0;
        const scale = zoom >= 15 ? "scale(1.5)" : "";
        pinElementsRef.current.forEach((pin, id) => {
          // Don't override selected marker's transform
          if (id !== selectedIdRef.current) {
            pin.style.transform = scale;
          }
        });
      };
      applyZoomScale();
      zoomListenerRef.current = map.addListener("zoom_changed", applyZoomScale);
    }

    clustererRef.current = new MarkerClusterer({
      map,
      markers: newMarkers,
      algorithm: new SuperClusterAlgorithm({
        maxZoom: CLUSTER_MAX_ZOOM,
        radius: 80,
      }),
      renderer: {
        render({ count, position }) {
          const size = Math.min(24 + Math.log2(count) * 8, 56);
          const el = document.createElement("div");
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#2563eb";
          el.style.border = "3px solid white";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.color = "white";
          el.style.fontSize = `${Math.max(11, 14 - Math.floor(count / 100))}px`;
          el.style.fontWeight = "700";
          el.style.cursor = "pointer";
          el.textContent = count > 999 ? `${(count / 1000).toFixed(1)}k` : String(count);

          return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: el,
          });
        },
      },
    });

    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      pinElementsRef.current.clear();
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
      if (zoomListenerRef.current) {
        zoomListenerRef.current.remove();
        zoomListenerRef.current = null;
      }
    };
  }, [map, ready, contacts, onMarkerClick, settings, coverageMap]);

  // Update only the affected pins when selection changes
  useEffect(() => {
    const prevId = selectedIdRef.current;

    if (prevId) {
      const prev = pinElementsRef.current.get(prevId);
      if (prev) {
        prev.style.transform = "";
        prev.style.zIndex = "";
      }
    }

    if (selectedId) {
      const next = pinElementsRef.current.get(selectedId);
      if (next) {
        next.style.transform = "scale(1.4)";
        next.style.zIndex = "10";
      }
    }

    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
        style={
          settings.simplifiedMap
            ? { filter: "grayscale(0.6) brightness(1.08) contrast(0.92)" }
            : undefined
        }
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}

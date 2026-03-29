"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { loadGoogleMaps } from "@/lib/google/maps-loader";
import { SA_CENTER, DEFAULT_ZOOM } from "@/types/maps";

export function useMap(containerRef: React.RefObject<HTMLDivElement | null>) {
  const mapRef = useRef<google.maps.Map | null>(null);
  // Use state (not just ref) so components re-render when the map is initialized
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    loadGoogleMaps()
      .then(() => {
        if (!containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: SA_CENTER,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          styles: [
            // Hide all POIs (businesses, restaurants, parks, landmarks, etc.)
            { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
            // Hide transit (bus stops, subway, rail)
            { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
            // Hide all administrative labels (city names, neighborhoods, land parcels)
            { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
            // Hide landscape labels
            { featureType: "landscape", elementType: "labels", stylers: [{ visibility: "off" }] },
            // Hide water labels
            { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
            // Hide highway shields & road icons
            { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            // Hide highway labels
            { featureType: "road.highway", elementType: "labels", stylers: [{ visibility: "off" }] },
            // Hide arterial road labels
            { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "off" }] },
            // Local street names only — light gray
            { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            { featureType: "road.local", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 2 }] },
          ],
        });

        mapRef.current = map;
        setMapInstance(map);
        setReady(true);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [containerRef]);

  const panTo = useCallback((lat: number, lng: number, zoom?: number) => {
    if (!mapRef.current) return;
    mapRef.current.panTo({ lat, lng });
    if (zoom) mapRef.current.setZoom(zoom);
  }, []);

  const fitBounds = useCallback(
    (points: { lat: number; lng: number }[]) => {
      if (!mapRef.current || points.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 50);
    },
    []
  );

  return { map: mapInstance, ready, error, panTo, fitBounds };
}

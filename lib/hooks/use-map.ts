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
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          styles: [
            // Hide all points of interest (restaurants, shops, hospitals, parks, etc.)
            { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
            // Hide transit (bus stops, subway lines, rail stations)
            { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
            // Hide business icons on the road layer
            { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            // Tone down road labels (keep street names but lighter)
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
            // Lighten water labels
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
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

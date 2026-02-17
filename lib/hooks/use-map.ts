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
          mapId: "sapd-ops-map",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
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

"use client";

import { useState, useCallback, useRef } from "react";

export interface PlaceResult {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  formatted_address?: string;
  phone?: string;
}

export function usePlacesSearch() {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);

  const getService = useCallback(() => {
    if (serviceRef.current) return serviceRef.current;
    // PlacesService needs an HTMLDivElement or a Map as attribution container
    const div = document.createElement("div");
    serviceRef.current = new google.maps.places.PlacesService(div);
    return serviceRef.current;
  }, []);

  const search = useCallback(
    (query: string) => {
      if (!query.trim()) return;
      setLoading(true);

      const service = getService();
      service.textSearch(
        {
          query,
          // Bias to San Antonio area
          location: new google.maps.LatLng(29.4241, -98.4936),
          radius: 80000,
        },
        (places, status) => {
          setLoading(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            places
          ) {
            setResults(
              places
                .filter((p) => p.geometry?.location)
                .map((p) => ({
                  place_id: p.place_id || "",
                  name: p.name || "",
                  lat: p.geometry!.location!.lat(),
                  lng: p.geometry!.location!.lng(),
                  formatted_address: p.formatted_address || undefined,
                  phone: undefined, // textSearch doesn't return phone
                }))
            );
          } else {
            setResults([]);
          }
        }
      );
    },
    [getService]
  );

  const clear = useCallback(() => {
    setResults([]);
  }, []);

  return { results, search, clear, loading };
}

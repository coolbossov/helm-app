"use client";

import { useState, useEffect } from "react";

export interface MapSettings {
  outlinedMarkers: boolean; // Option A: dark outline + zoom scale
  pinMarkers: boolean;      // Option B: SVG teardrop pins
  simplifiedMap: boolean;   // Option C: muted CSS filter on map
  coverageOverlay: boolean; // Color rings by visit recency
}

const STORAGE_KEY = "sapd-map-settings";

const DEFAULT_SETTINGS: MapSettings = {
  outlinedMarkers: true,
  pinMarkers: false,
  simplifiedMap: false,
  coverageOverlay: false,
};

export function useMapSettings() {
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // ignore
    }
  }, []);

  const updateSetting = (key: keyof MapSettings, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { settings, updateSetting };
}

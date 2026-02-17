"use client";

import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import type { MapSettings } from "@/lib/hooks/use-map-settings";

interface MapSettingsProps {
  settings: MapSettings;
  onChange: (key: keyof MapSettings, value: boolean) => void;
}

export function MapSettingsButton({ settings, onChange }: MapSettingsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50"
        title="Map settings"
      >
        <Settings className="h-4 w-4 text-gray-600" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">
            Marker Options
          </p>

          <Toggle
            label="Outlined markers"
            description="Dark ring + larger at street level"
            checked={settings.outlinedMarkers}
            onChange={(v) => onChange("outlinedMarkers", v)}
          />

          <Toggle
            label="Pin shape markers"
            description="Teardrop SVG pins"
            checked={settings.pinMarkers}
            onChange={(v) => onChange("pinMarkers", v)}
          />

          <div className="my-2 border-t border-gray-100" />
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">
            Map Style
          </p>

          <Toggle
            label="Simplified map"
            description="Muted base map colors"
            checked={settings.simplifiedMap}
            onChange={(v) => onChange("simplifiedMap", v)}
          />

          <Toggle
            label="Coverage overlay"
            description="Color rings by visit recency"
            checked={settings.coverageOverlay}
            onChange={(v) => onChange("coverageOverlay", v)}
          />
        </div>
      )}
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 hover:bg-gray-50">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

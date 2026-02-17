"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { BUSINESS_TYPE_COLORS } from "@/types";

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_COLORS);

interface AddPlaceModalProps {
  place: {
    place_id: string;
    name: string;
    lat: number;
    lng: number;
    formatted_address?: string;
    phone?: string;
  };
  onClose: () => void;
  onAdded: () => void;
}

export function AddPlaceModal({ place, onClose, onAdded }: AddPlaceModalProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAdd = async () => {
    if (selectedTypes.length === 0) {
      setError("Select at least one business type");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/from-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address || "",
          lat: place.lat,
          lng: place.lng,
          phone: place.phone || null,
          business_type: selectedTypes,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to add");
      }
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{place.name}</h3>
            {place.formatted_address && (
              <p className="mt-0.5 text-xs text-gray-500">
                {place.formatted_address}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">
          Business Type
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {BUSINESS_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                selectedTypes.includes(type)
                  ? "text-white border-transparent"
                  : "text-gray-500 border-gray-200 bg-white hover:bg-gray-50"
              }`}
              style={
                selectedTypes.includes(type)
                  ? { backgroundColor: BUSINESS_TYPE_COLORS[type] }
                  : undefined
              }
            >
              {type}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <Button onClick={handleAdd} disabled={saving} className="w-full">
          {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
          Add to CRM
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ContactMarkerData } from "@/types";

interface ImportStopsModalProps {
  onClose: () => void;
  onImport: (contacts: ContactMarkerData[]) => void;
}

interface ParsedRow {
  name: string;
  address: string;
}

interface ImportResult {
  name: string;
  address: string;
  contact: ContactMarkerData | null;
  error?: string;
}

const PLACEHOLDER = `School Name, 123 Main St, City, State 12345
Dance Studio, 456 Oak Ave, Springfield, IL
Another Place, 789 Elm Rd`;

function parseInput(raw: string): ParsedRow[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) return null;
      const name = line.slice(0, commaIdx).trim();
      const address = line.slice(commaIdx + 1).trim();
      return name && address ? { name, address } : null;
    })
    .filter((row): row is ParsedRow => row !== null);
}

export function ImportStopsModal({ onClose, onImport }: ImportStopsModalProps) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = parseInput(text);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target?.result as string ?? "");
    };
    reader.readAsText(file);
  };

  const handleGeocode = async () => {
    if (parsed.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");

      const importResults: ImportResult[] = json.data.map(
        (r: { name: string; address: string; contact: ContactMarkerData | null; error?: string }) => ({
          name: r.name,
          address: r.address,
          contact: r.contact ? {
            id: r.contact.id,
            zoho_id: r.contact.zoho_id,
            last_name: r.contact.last_name,
            account_name: r.contact.account_name,
            latitude: r.contact.latitude,
            longitude: r.contact.longitude,
            business_type: r.contact.business_type ?? [],
            priority: r.contact.priority ?? null,
            lifecycle_stage: r.contact.lifecycle_stage ?? null,
            contacting_status: r.contact.contacting_status ?? null,
          } : null,
          error: r.error,
        })
      );
      setResults(importResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const successfulContacts = results?.filter((r) => r.contact !== null).map((r) => r.contact!) ?? [];

  const handleAddAll = () => {
    onImport(successfulContacts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Import Stops</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!results ? (
            <>
              <p className="text-sm text-gray-600">
                Paste addresses below, one per line in <strong>Name, Address</strong> format — or upload a CSV file.
              </p>

              {/* File upload */}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload CSV file
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />

              {/* Text area */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={8}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />

              {parsed.length > 0 && (
                <p className="text-xs text-gray-500">
                  <FileText className="inline h-3.5 w-3.5 mr-1" />
                  {parsed.length} {parsed.length === 1 ? "stop" : "stops"} ready to geocode
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {successfulContacts.length} of {results.length} stops geocoded successfully.
              </p>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-sm",
                      r.contact ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    )}
                  >
                    {r.contact
                      ? <CheckCircle className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                      : <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.address}</p>
                      {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 flex gap-2">
          {!results ? (
            <>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleGeocode}
                disabled={parsed.length === 0 || loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Geocoding…" : `Geocode ${parsed.length} stops`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setResults(null)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleAddAll}
                disabled={successfulContacts.length === 0}
                className="flex-1"
              >
                Add {successfulContacts.length} stops
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  ChevronUp,
  ChevronDown,
  Download,
  Link,
  QrCode,
  MapPin,
  Trash2,
  CheckCircle,
  Navigation,
  PlusCircle,
  Save,
} from "lucide-react";
import type { ContactMarkerData } from "@/types";
import { Spinner } from "@/components/ui";

interface RouteBuilderProps {
  stops: ContactMarkerData[];
  allFiltered: ContactMarkerData[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAddAll: () => void;
  onClear: () => void;
  onClose: () => void;
  onMarkAllVisited: () => Promise<void>;
  onSaveRoute: () => Promise<string | null>;
}

function buildGoogleMapsLink(batch: ContactMarkerData[]): string {
  if (batch.length === 0) return "";
  const encode = (c: ContactMarkerData) =>
    encodeURIComponent(`${c.latitude},${c.longitude}`);
  if (batch.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encode(batch[0])}`;
  }
  const origin = encode(batch[0]);
  const destination = encode(batch[batch.length - 1]);
  const mid = batch.slice(1, -1).map(encode);
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (mid.length > 0) url += `&waypoints=${mid.join("|")}`;
  return url;
}

function buildCSV(stops: ContactMarkerData[]): string {
  const header = "Stop #,Name,Organization,Lat,Lng,Visit Status";
  const rows = stops.map((s, i) => {
    const name = [s.account_name, s.last_name].filter(Boolean).join(" / ");
    return [
      i + 1,
      `"${name.replace(/"/g, '""')}"`,
      `"${(s.account_name ?? "").replace(/"/g, '""')}"`,
      s.latitude,
      s.longitude,
      `"${s.visit_status ?? "Never Visited"}"`,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

function downloadCSV(stops: ContactMarkerData[]) {
  const csv = buildCSV(stops);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `route-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Split stops into batches of 10 (Google Maps limit)
function splitBatches(stops: ContactMarkerData[]): ContactMarkerData[][] {
  const batches: ContactMarkerData[][] = [];
  for (let i = 0; i < stops.length; i += 10) {
    batches.push(stops.slice(i, i + 10));
  }
  return batches;
}

export function RouteBuilder({
  stops,
  allFiltered,
  onRemove,
  onReorder,
  onAddAll,
  onClear,
  onClose,
  onMarkAllVisited,
  onSaveRoute,
}: RouteBuilderProps) {
  const [showQR, setShowQR] = useState<string | null>(null); // QR modal: the URL to encode
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [markingVisited, setMarkingVisited] = useState(false);
  const [visitedDone, setVisitedDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const batches = splitBatches(stops);
  const hasManyStops = stops.length > 10;

  const handleCopyLink = useCallback(
    (url: string, index: number) => {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      });
    },
    []
  );

  const handleMarkVisited = async () => {
    setMarkingVisited(true);
    try {
      await onMarkAllVisited();
      setVisitedDone(true);
      setTimeout(() => setVisitedDone(false), 3000);
    } finally {
      setMarkingVisited(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveRoute();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Route Builder</span>
            {stops.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {stops.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {stops.length > 0 && (
              <button
                onClick={onClear}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                title="Clear all stops"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stop list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {stops.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <MapPin className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                Click markers on the map to add stops
              </p>
              {allFiltered.length > 0 && (
                <button
                  onClick={onAddAll}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add all {allFiltered.length} filtered contacts
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Add all button */}
              {allFiltered.length > stops.length && (
                <div className="px-4 py-2">
                  <button
                    onClick={onAddAll}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add all {allFiltered.length} filtered contacts
                  </button>
                </div>
              )}

              {stops.map((stop, i) => {
                const displayName = stop.account_name || stop.last_name;
                return (
                  <div key={stop.id} className="flex items-center gap-2 px-3 py-2">
                    {/* Number badge */}
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>

                    {/* Name */}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800">
                      {displayName}
                    </span>

                    {/* Reorder */}
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => onReorder(i, i - 1)}
                        disabled={i === 0}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onReorder(i, i + 1)}
                        disabled={i === stops.length - 1}
                        className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => onRemove(stop.id)}
                      className="shrink-0 text-gray-300 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions footer */}
        {stops.length > 0 && (
          <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-3">
            {/* CSV download */}
            <button
              onClick={() => downloadCSV(stops)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV (MyWay / ZEO / Spoke)
            </button>

            {/* Google Maps deep links — one per batch of 10 */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                Google Maps{hasManyStops ? ` (split into ${batches.length} legs)` : ""}
              </p>
              {batches.map((batch, batchIdx) => {
                const url = buildGoogleMapsLink(batch);
                const label = hasManyStops
                  ? `Leg ${batchIdx + 1}: stops ${batchIdx * 10 + 1}–${batchIdx * 10 + batch.length}`
                  : `Open in Google Maps`;
                return (
                  <div key={batchIdx} className="flex items-center gap-1.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Navigation className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                    </a>
                    <button
                      onClick={() => handleCopyLink(url, batchIdx)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-600 hover:bg-gray-50"
                      title="Copy link"
                    >
                      {copiedIndex === batchIdx ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Link className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowQR(url)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-600 hover:bg-gray-50"
                      title="Show QR code"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Mark all visited */}
            <button
              onClick={handleMarkVisited}
              disabled={markingVisited}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
            >
              {markingVisited ? (
                <Spinner size="sm" />
              ) : visitedDone ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              {visitedDone ? "All marked as Visited!" : "Mark all as Visited"}
            </button>

            {/* Save to routes */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
            >
              {saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
              Save & Optimize Route
            </button>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowQR(null)}
        >
          <div
            className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Scan to open on iPhone</p>
              <button onClick={() => setShowQR(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <QRCodeSVG value={showQR} size={220} />
            <p className="text-center text-[11px] text-gray-400">
              Opens in Google Maps on your phone
            </p>
          </div>
        </div>
      )}
    </>
  );
}

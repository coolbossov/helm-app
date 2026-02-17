"use client";

import { ChevronUp, ChevronDown, X, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@/lib/utils";
import type { BuilderStop } from "@/lib/hooks/use-route-builder";

interface StopListProps {
  stops: BuilderStop[];
  onMove: (from: number, to: number) => void;
  onRemove: (contactId: string) => void;
  className?: string;
}

export function StopList({ stops, onMove, onRemove, className }: StopListProps) {
  if (stops.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-10 text-gray-400", className)}>
        <MapPin className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm text-center">Click contacts on the map to add stops</p>
      </div>
    );
  }

  return (
    <ol className={cn("space-y-1.5", className)}>
      {stops.map((stop, index) => {
        const contact = stop.contact;
        const name = getDisplayName(contact);
        const types = contact.business_type.join(", ");

        return (
          <li
            key={contact.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              {types && <p className="truncate text-xs text-gray-500">{types}</p>}
            </div>

            <div className="flex shrink-0 flex-col">
              <button
                onClick={() => onMove(index, index - 1)}
                disabled={index === 0}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onMove(index, index + 1)}
                disabled={index === stops.length - 1}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={() => onRemove(contact.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// For driving mode — shows stop status toggles
interface DrivingStopProps {
  index: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  status: "pending" | "visited" | "skipped";
  onStatusChange: (status: "pending" | "visited" | "skipped") => void;
}

export function DrivingStop({ index, name, address, phone, status, onStatusChange }: DrivingStopProps) {
  return (
    <div className={cn(
      "rounded-xl border p-4 transition-colors",
      status === "visited" && "border-green-200 bg-green-50",
      status === "skipped" && "border-gray-200 bg-gray-50 opacity-60",
      status === "pending" && "border-gray-200 bg-white"
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          status === "visited" ? "bg-green-600 text-white" : "bg-blue-600 text-white"
        )}>
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{name}</p>
          {address && <p className="text-sm text-gray-500">{address}</p>}
        </div>

        {phone && (
          <a href={`tel:${phone}`} className="shrink-0 rounded-lg p-2 text-blue-600 hover:bg-blue-50">
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onStatusChange("visited")}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
            status === "visited"
              ? "bg-green-600 text-white"
              : "border border-green-300 text-green-700 hover:bg-green-50"
          )}
        >
          Visited
        </button>
        <button
          onClick={() => onStatusChange("skipped")}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
            status === "skipped"
              ? "bg-gray-400 text-white"
              : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          )}
        >
          Skip
        </button>
        {status !== "pending" && (
          <button
            onClick={() => onStatusChange("pending")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

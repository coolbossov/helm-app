"use client";

import { useRef, useState } from "react";
import { X, MapPin, Phone, Clock, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDisplayName } from "@/lib/utils";
import type { BuilderStop } from "@/lib/hooks/use-route-builder";
import type { StopPriority } from "@/types/routes";

interface StopListProps {
  stops: BuilderStop[];
  onMove: (from: number, to: number) => void;
  onRemove: (contactId: string) => void;
  className?: string;
}

export function StopList({ stops, onMove, onRemove, className }: StopListProps) {
  const dragIdx = useRef<number | null>(null);
  const [draggingOver, setDraggingOver] = useState<number | null>(null);

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
            draggable
            onDragStart={() => { dragIdx.current = index; }}
            onDragOver={(e) => { e.preventDefault(); setDraggingOver(index); }}
            onDragLeave={() => setDraggingOver(null)}
            onDrop={() => {
              if (dragIdx.current !== null && dragIdx.current !== index) {
                onMove(dragIdx.current, index);
              }
              dragIdx.current = null;
              setDraggingOver(null);
            }}
            onDragEnd={() => { dragIdx.current = null; setDraggingOver(null); }}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 cursor-grab active:cursor-grabbing transition-colors",
              draggingOver === index && "border-blue-400 bg-blue-50"
            )}
          >
            <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />

            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              {types && <p className="truncate text-xs text-gray-500">{types}</p>}
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

// For driving mode — shows stop status toggles + priority + time window
interface DrivingStopProps {
  index: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  status: "pending" | "visited" | "skipped";
  priority?: StopPriority;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  expectedDurationMin?: number;
  onStatusChange: (status: "pending" | "visited" | "skipped") => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
}

export function DrivingStop({
  index,
  name,
  address,
  phone,
  status,
  priority = "nice_to_visit",
  timeWindowStart,
  timeWindowEnd,
  expectedDurationMin,
  onStatusChange,
  onToggleExpand,
  expanded,
}: DrivingStopProps) {
  const hasTimeWindow = timeWindowStart || timeWindowEnd;
  const timeLabel = hasTimeWindow
    ? [timeWindowStart?.slice(0, 5), timeWindowEnd?.slice(0, 5)].filter(Boolean).join(" – ")
    : null;

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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{name}</p>
            {priority === "must_visit" && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                Must Visit
              </span>
            )}
          </div>
          {address && <p className="text-sm text-gray-500 mt-0.5">{address}</p>}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {timeLabel && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {timeLabel}
              </span>
            )}
            {expectedDurationMin && expectedDurationMin !== 15 && (
              <span className="text-xs text-gray-400">{expectedDurationMin} min</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {phone && (
            <a href={`tel:${phone}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
              <Phone className="h-4 w-4" />
            </a>
          )}
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
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

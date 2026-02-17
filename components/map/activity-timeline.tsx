"use client";

import { MessageSquare, Phone, MapPin, RefreshCw, Edit } from "lucide-react";
import type { ContactActivity, ActivityType } from "@/types";

function typeIcon(type: ActivityType) {
  switch (type) {
    case "visit": return <MapPin className="h-3.5 w-3.5" />;
    case "call": return <Phone className="h-3.5 w-3.5" />;
    case "note": return <MessageSquare className="h-3.5 w-3.5" />;
    case "status_change": return <RefreshCw className="h-3.5 w-3.5" />;
    case "field_change": return <Edit className="h-3.5 w-3.5" />;
  }
}

function typeColor(type: ActivityType) {
  switch (type) {
    case "visit": return "bg-green-100 text-green-700";
    case "call": return "bg-blue-100 text-blue-700";
    case "note": return "bg-purple-100 text-purple-700";
    case "status_change": return "bg-amber-100 text-amber-700";
    case "field_change": return "bg-gray-100 text-gray-600";
  }
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

interface ActivityTimelineProps {
  activities: ContactActivity[];
  loading: boolean;
}

export function ActivityTimeline({ activities, loading }: ActivityTimelineProps) {
  if (loading) {
    return <p className="text-xs text-gray-400 py-2">Loading…</p>;
  }

  if (activities.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No activity yet.</p>;
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-2.5">
          <div
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${typeColor(a.activity_type)}`}
          >
            {typeIcon(a.activity_type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-medium text-gray-800 truncate">
                {a.title || a.activity_type}
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {relativeTime(a.created_at)}
              </span>
            </div>
            {a.content && a.content !== a.title && (
              <p className="text-xs text-gray-500 whitespace-pre-line">{a.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

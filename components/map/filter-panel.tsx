"use client";

import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ContactFilters, Priority, LifecycleStage, ContactingStatus } from "@/types";

const BUSINESS_TYPES = ["Dance", "School", "Daycare", "Cheer", "Sports", "Other"];
const PRIORITIES: Priority[] = [
  "Hot Priority",
  "High Priority",
  "Warm Priority",
  "Medium Priority",
  "Low Priority",
];
const LIFECYCLE_STAGES: LifecycleStage[] = [
  "Lead",
  "Contacted",
  "Qualified",
  "Proposal",
  "Customer",
  "Churned",
];
const CONTACTING_STATUSES: ContactingStatus[] = [
  "Not Contacted",
  "Attempted",
  "In Conversation",
  "Follow Up",
  "Not Interested",
  "Closed",
];

interface FilterPanelProps {
  filters: ContactFilters;
  onUpdate: <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => void;
  onReset: () => void;
  activeCount: number;
  onClose?: () => void;
  className?: string;
}

function CheckboxGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: T[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </h4>
      <div className="space-y-1">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({
  filters,
  onUpdate,
  onReset,
  activeCount,
  onClose,
  className,
}: FilterPanelProps) {
  return (
    <div className={cn("flex h-full flex-col bg-white", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <CheckboxGroup
          label="Business Type"
          options={BUSINESS_TYPES}
          selected={filters.business_types}
          onChange={(v) => onUpdate("business_types", v)}
        />

        <CheckboxGroup
          label="Priority"
          options={PRIORITIES}
          selected={filters.priorities}
          onChange={(v) => onUpdate("priorities", v)}
        />

        <CheckboxGroup
          label="Lifecycle Stage"
          options={LIFECYCLE_STAGES}
          selected={filters.lifecycle_stages}
          onChange={(v) => onUpdate("lifecycle_stages", v)}
        />

        <CheckboxGroup
          label="Contacting Status"
          options={CONTACTING_STATUSES}
          selected={filters.contacting_statuses}
          onChange={(v) => onUpdate("contacting_statuses", v)}
        />
      </div>
    </div>
  );
}

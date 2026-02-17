"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactMarkerData } from "@/types";
import { BUSINESS_TYPE_COLORS } from "@/types";

interface SearchBarProps {
  contacts: ContactMarkerData[];
  onSelect: (contact: ContactMarkerData) => void;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SearchBar({
  contacts,
  onSelect,
  value,
  onChange,
  className,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results =
    value.length >= 2
      ? contacts
          .filter((c) => {
            const name = (c.account_name || c.last_name).toLowerCase();
            return name.includes(value.toLowerCase());
          })
          .slice(0, 8)
      : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search contacts…"
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        />
        {value && (
          <button
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                onSelect(contact);
                setFocused(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: contact.business_type[0]
                    ? (BUSINESS_TYPE_COLORS[contact.business_type[0]] ?? "#6b7280")
                    : "#6b7280",
                }}
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {contact.account_name || contact.last_name}
                </p>
                {contact.business_type.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {contact.business_type.join(", ")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

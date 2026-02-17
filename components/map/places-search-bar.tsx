"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Spinner } from "@/components/ui";

interface PlacesSearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function PlacesSearchBar({ onSearch, loading }: PlacesSearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 shadow-sm"
    >
      <Search className="h-4 w-4 text-orange-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search places (e.g. dance studio, daycare)…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        autoFocus
      />
      {loading && <Spinner />}
    </form>
  );
}

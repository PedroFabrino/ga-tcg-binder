"use client";

import { Search, X } from "lucide-react";

interface CollectionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CollectionSearchBar({
  value,
  onChange,
  placeholder = "Filter collection by card name, set, or number...",
  className = "",
}: CollectionSearchBarProps) {
  return (
    <div
      className={`relative flex items-center gap-2 rounded-2xl glass p-2 transition-all focus-within:border-cyan-400/40 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.1)] ${className}`}
    >
      <Search className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Filter collection"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white placeholder:text-slate-500 outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear filter"
          className="mr-2 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

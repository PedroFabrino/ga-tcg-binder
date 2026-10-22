"use client";

import { cn } from "@/lib/utils";

type FilterChipVariant = "default" | "accent";

interface FilterChipProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
  className?: string;
  variant?: FilterChipVariant;
}

const variantStyles: Record<FilterChipVariant, { active: string; inactive: string }> = {
  default: {
    active: "bg-white/12 text-white",
    inactive: "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200",
  },
  accent: {
    active: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    inactive: "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white",
  },
};

/**
 * Reusable filter/toggle chip with aria-pressed support.
 * Used by SetChecklistHeader prefix chips and SetChecklistFilters status chips.
 */
export default function FilterChip({
  label,
  pressed,
  onClick,
  className,
  variant = "default",
}: FilterChipProps) {
  const styles = variantStyles[variant];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        pressed ? styles.active : styles.inactive,
        className,
      )}
    >
      {label}
    </button>
  );
}
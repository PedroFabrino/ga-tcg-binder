"use client";

import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="skeleton h-32 w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
        <div className="flex gap-1.5">
          <div className="skeleton h-4 w-12 rounded-full" />
          <div className="skeleton h-4 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="skeleton h-10 w-8 rounded" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-2 w-1/4 rounded" />
      </div>
      <div className="skeleton h-8 w-20 rounded-lg" />
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] mb-4">
        <Icon className="h-7 w-7 text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {description && <p className="text-xs text-slate-600 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

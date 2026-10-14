"use client";

import { ReactNode, useEffect } from "react";
import { X, Minus, Plus, Gem, Sparkles } from "lucide-react";
import { getElementClass } from "@/lib/elements";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#05070c]/80 backdrop-blur-sm animate-backdrop" onClick={onClose} />
      <div className={`relative flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl glass-strong shadow-2xl shadow-black/60 animate-modal`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ElementBadge({ element }: { element: string }) {
  return (
    <span className={`${getElementClass(element)} el-text el-bg-soft el-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--el)" }} />
      {element || "NORM"}
    </span>
  );
}

export function LowPopBadge({ population }: { population?: number }) {
  return (
    <span className="gold-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" title="Low population printing">
      <Gem className="h-2.5 w-2.5" />
      Low Pop{population ? <span className="font-mono">{population.toLocaleString()}</span> : null}
    </span>
  );
}

export function FoilBadge() {
  return (
    <span className="foil-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Sparkles className="h-2.5 w-2.5" />
      Foil
    </span>
  );
}

const RARITY_GEM: Record<string, { label: string; color: string }> = {
  "1": { label: "Common", color: "#94a3b8" },
  "2": { label: "Uncommon", color: "#10b981" },
  "3": { label: "Rare", color: "#06b6d4" },
  "4": { label: "Super Rare", color: "#f59e0b" },
  "5": { label: "Ultra Rare", color: "#f43f5e" },
  "6": { label: "Promo", color: "#38bdf8" },
  "7": { label: "Collector", color: "#e8c967" },
  "8": { label: "Collector Super", color: "#e8c967" },
};

export function RarityGem({ rarity }: { rarity: string | number }) {
  const key = String(rarity);
  const info = RARITY_GEM[key] || { label: `Rarity ${key}`, color: "#94a3b8" };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400" title={info.label}>
      <span className="h-2 w-2 rotate-45 rounded-[2px]" style={{ background: info.color, boxShadow: `0 0 6px ${info.color}` }} />
      {info.label}
    </span>
  );
}

export function QuantityStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/20" role="group" aria-label={`Quantity for ${label}`}>
      <button
        onClick={() => onChange(-1)}
        disabled={disabled}
        aria-label={`Remove one ${label}`}
        className="stepper-btn rounded-l-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span key={value} className="w-8 text-center font-mono text-sm font-semibold text-white animate-fade-in">{value}</span>
      <button
        onClick={() => onChange(1)}
        disabled={disabled}
        aria-label={`Add one ${label}`}
        className="stepper-btn rounded-r-lg p-1.5 text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-40"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
      <div>
        <p className="label-caps mb-2">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: any }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              isActive ? "bg-white/[0.08] text-white shadow-inner shadow-white/[0.02]" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function CardArt({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-[10px] font-medium text-slate-500 ${className}`}>
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-rose-400 active:scale-[0.98] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-300">{message}</p>
    </Modal>
  );
}

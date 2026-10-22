"use client";

import { ReactNode } from "react";
import { Minus, Plus, Gem, Sparkles } from "lucide-react";
import { getElementClass } from "@/lib/elements";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs as TabsRoot, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MODAL_WIDTH = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

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
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={MODAL_WIDTH[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function ElementBadge({ element }: { element: string }) {
  return (
    <Badge variant="element" className={getElementClass(element)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--el)" }} />
      {element || "NORM"}
    </Badge>
  );
}

export function LowPopBadge({ population }: { population?: number }) {
  return (
    <Badge variant="gold" title="Low population printing">
      <Gem className="h-2.5 w-2.5" />
      Low Pop{population ? <span className="font-mono">{population.toLocaleString()}</span> : null}
    </Badge>
  );
}

export function FoilBadge() {
  return (
    <Badge variant="foil">
      <Sparkles className="h-2.5 w-2.5" />
      Foil
    </Badge>
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
  canDecrement = true,
  canIncrement = true,
}: {
  value: number;
  onChange: (delta: number) => void;
  disabled?: boolean;
  label: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/20" role="group" aria-label={t("common.quantityStepperGroup", { label })}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(-1)}
        disabled={disabled || !canDecrement}
        aria-label={t("common.quantityStepperRemove", { label })}
        className="stepper-btn rounded-r-none hover:bg-rose-500/15 hover:text-rose-300"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span key={value} className="w-8 text-center font-mono text-sm font-semibold text-white animate-fade-in">{value}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(1)}
        disabled={disabled || !canIncrement}
        aria-label={t("common.quantityStepperAdd", { label })}
        className="stepper-btn rounded-l-none hover:bg-emerald-500/15 hover:text-emerald-300"
      >
        <Plus className="h-3 w-3" />
      </Button>
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
    <TabsRoot value={active} onValueChange={(v) => onChange(v as T)}>
      <TabsList>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.id} value={t.id}>
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </TabsRoot>
  );
}

export function CardArt({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-[10px] font-medium text-slate-500", className)}>
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-300">{message}</p>
    </Modal>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "border border-white/[0.08] bg-white/[0.04] text-slate-300",
        element: "el-text el-bg-soft el-border border",
        gold: "gold-badge font-bold",
        foil: "foil-chip font-bold",
        success: "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
        warning: "border border-amber-400/20 bg-amber-500/10 text-amber-300",
        destructive: "border border-rose-400/20 bg-rose-500/10 text-rose-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

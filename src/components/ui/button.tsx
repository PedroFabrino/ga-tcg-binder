import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary font-semibold text-primary-foreground shadow-lg shadow-black/30 hover:bg-slate-200",
        accent:
          "bg-gradient-to-b from-cyan-400 to-cyan-600 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-300 hover:to-cyan-500",
        outline: "border border-white/[0.08] bg-white/[0.03] font-medium text-slate-200 hover:bg-white/[0.07] hover:text-white",
        ghost: "font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white",
        destructive: "bg-destructive font-semibold text-destructive-foreground hover:bg-rose-400",
        gold: "border border-gold/30 bg-gold/10 font-semibold text-gold-bright hover:bg-gold/20",
        link: "font-medium text-cyan-300 underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 py-1.5 text-xs",
        lg: "px-6 py-3 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

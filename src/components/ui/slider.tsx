"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn("relative flex w-full touch-none select-none items-center py-2", className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/[0.08]">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-gold-dim to-gold-bright" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-gold-bright bg-background shadow-[0_0_10px_var(--gold-glow)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

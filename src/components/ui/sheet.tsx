"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "left" | "right" }
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-[60] bg-[#05070c]/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 z-[60] flex w-[85%] max-w-sm flex-col glass-strong shadow-2xl shadow-black/60 outline-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "right"
          ? "right-0 border-l border-white/[0.06] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          : "left-0 border-r border-white/[0.06] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-sm font-semibold text-white", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };

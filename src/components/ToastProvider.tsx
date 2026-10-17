"use client";

import React, { ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type ToastType = "success" | "error" | "info";

function showToast(message: string, type: ToastType = "success") {
  toast[type](message);
}

export function useToast() {
  return { showToast };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

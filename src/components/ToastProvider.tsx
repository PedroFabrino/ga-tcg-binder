"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showToast: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-toast pointer-events-auto flex items-center space-x-3 rounded-xl glass-strong px-4 py-3 shadow-2xl max-w-sm"
          >
            {toast.type === "success" && <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
            {toast.type === "error" && <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />}
            {toast.type === "info" && <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />}
            <span className="text-sm text-slate-200 flex-1">{toast.message}</span>
            <button onClick={() => dismiss(toast.id)} className="text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

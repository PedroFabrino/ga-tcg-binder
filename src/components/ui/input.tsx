import * as React from "react";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-cyan-400/50 focus:bg-white/[0.05] focus:ring-2 focus:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => <input type={type} className={cn(inputClass, className)} ref={ref} {...props} />
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea className={cn(inputClass, className)} ref={ref} {...props} />
);
Textarea.displayName = "Textarea";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select className={cn(inputClass, className)} ref={ref} {...props} />
);
NativeSelect.displayName = "NativeSelect";

export { Input, Textarea, NativeSelect };

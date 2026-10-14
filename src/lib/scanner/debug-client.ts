"use client";

export interface LogEntry {
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  details?: any;
  time: string;
}

const logBuffer: LogEntry[] = [];
const listeners: Array<(entries: LogEntry[]) => void> = [];

export function getDebugLogs(): LogEntry[] {
  return [...logBuffer];
}

export function subscribeDebugLogs(fn: (entries: LogEntry[]) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function logScanner(
  stage: string,
  message: string,
  details: any = {},
  level: "info" | "warn" | "error" = "info"
) {
  const time = new Date().toISOString().substring(11, 23);
  const entry: LogEntry = { stage, level, message, details, time };

  // Keep last 30 logs in buffer
  logBuffer.push(entry);
  if (logBuffer.length > 30) logBuffer.shift();

  listeners.forEach((l) => l([...logBuffer]));

  // Also log to browser console
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[SCANNER_DEBUG] [${stage}] ${message}`, details);

  // Send to server in background so it appears in Vercel logs
  if (typeof window !== "undefined") {
    fetch("/api/scanner/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        stage,
        message,
        details: sanitizeDetails(details),
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {
      // ignore network errors sending logs
    });
  }
}

function sanitizeDetails(obj: any): any {
  if (!obj) return obj;
  try {
    return JSON.parse(
      JSON.stringify(obj, (key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        if (value instanceof MediaStreamTrack) {
          return {
            kind: value.kind,
            label: value.label,
            readyState: value.readyState,
            muted: value.muted,
          };
        }
        return value;
      })
    );
  } catch {
    return String(obj);
  }
}

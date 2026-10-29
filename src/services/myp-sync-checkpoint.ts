import * as fs from "fs";
import * as path from "path";
import type { ParsedMypItem } from "./marketplace";

export interface MypSyncCheckpoint {
  page: number;
  observedTotal: number;
  parsedItems: ParsedMypItem[];
  savedAt: number;
}

export const DEFAULT_CHECKPOINT_FILE = path.join(
  process.cwd(),
  ".scratch",
  "myp-sync-checkpoint.json"
);
export const MAX_CHECKPOINT_AGE_MS = 12 * 60 * 60 * 1000;

let inMemoryCheckpoint: MypSyncCheckpoint | null = null;

export function loadMypSyncCheckpoint(options?: {
  checkpointFile?: string;
  allowDisk?: boolean;
}): MypSyncCheckpoint | null {
  if (inMemoryCheckpoint) {
    if (Date.now() - inMemoryCheckpoint.savedAt <= MAX_CHECKPOINT_AGE_MS) {
      return inMemoryCheckpoint;
    }
    inMemoryCheckpoint = null;
  }

  const allowDisk = options?.allowDisk ?? true;
  if (!allowDisk) {
    return null;
  }

  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (
        data &&
        typeof data.page === "number" &&
        Array.isArray(data.parsedItems) &&
        typeof data.savedAt === "number" &&
        Date.now() - data.savedAt <= MAX_CHECKPOINT_AGE_MS
      ) {
        inMemoryCheckpoint = data;
        return data;
      }
    }
  } catch {
    // Ignore unreadable checkpoint file
  }

  return null;
}

export function saveMypSyncCheckpoint(
  checkpoint: MypSyncCheckpoint,
  options?: { checkpointFile?: string; persistToDisk?: boolean }
): void {
  inMemoryCheckpoint = checkpoint;
  const persistToDisk = options?.persistToDisk ?? true;
  if (!persistToDisk) {
    return;
  }

  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(checkpoint), "utf-8");
  } catch {
    // Best-effort persistence
  }
}

export function clearMypSyncCheckpoint(options?: { checkpointFile?: string }): void {
  inMemoryCheckpoint = null;
  const file = options?.checkpointFile || DEFAULT_CHECKPOINT_FILE;
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Best effort
  }
}

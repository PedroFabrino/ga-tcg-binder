/**
 * Terminal progress bar and dashboard for multi-store marketplace synchronization.
 *
 * Supports both interactive TTY (in-place multi-bar terminal updates) and
 * non-TTY environments (Docker daemon logs, CI, piped output) with clean,
 * throttled, store-tagged lines that avoid ANSI cursor escape corruption.
 */

export type StoreSyncStatus = "idle" | "running" | "retrying" | "completed" | "failed";

export interface StoreProgressState {
  storeId: string;
  storeName: string;
  platform: string;
  status: StoreSyncStatus;
  currentPage: number;
  totalPages: number;
  itemsSynced: number;
  matchedCount: number;
  durationSec?: number;
  message?: string;
  error?: string;
}

export type StoreProgressCallback = (update: {
  page?: number;
  totalPages?: number;
  itemsCount?: number;
  matchedCount?: number;
  status?: StoreSyncStatus;
  message?: string;
}) => void;

export function renderProgressBar(ratio: number, width = 16): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const filledLength = Math.round(clamped * width);
  const emptyLength = Math.max(0, width - filledLength);
  const filled = "█".repeat(filledLength);
  const empty = "░".repeat(emptyLength);
  const percent = (clamped * 100).toFixed(0).padStart(3);
  return `[${filled}${empty}] ${percent}%`;
}

export function formatDuration(sec?: number): string {
  if (sec === undefined || sec === null || !Number.isFinite(sec)) return "0.0s";
  return `${sec.toFixed(1)}s`;
}

export interface DashboardOptions {
  isTTY?: boolean;
  stream?: NodeJS.WriteStream;
}

export class MarketSyncProgressDashboard {
  private stores: Map<string, StoreProgressState> = new Map();
  private storeOrder: string[] = [];
  private isTTY: boolean;
  private stream: NodeJS.WriteStream;
  private renderedOnce = false;
  private previousLinesCount = 0;
  private startTime = Date.now();
  private cleanupRegistered = false;
  private lastLoggedMilestone: Map<string, number> = new Map();

  constructor(options?: DashboardOptions) {
    this.stream = options?.stream || process.stdout;
    this.isTTY = options?.isTTY !== undefined ? options.isTTY : Boolean(this.stream.isTTY);
  }

  public init(stores: { id: string; name: string; platform: string }[]): void {
    this.stores.clear();
    this.storeOrder = [];
    this.startTime = Date.now();

    for (const s of stores) {
      this.storeOrder.push(s.id);
      this.stores.set(s.id, {
        storeId: s.id,
        storeName: s.name,
        platform: s.platform,
        status: "idle",
        currentPage: 0,
        totalPages: 1,
        itemsSynced: 0,
        matchedCount: 0,
      });
    }

    if (this.isTTY && !this.cleanupRegistered) {
      this.cleanupRegistered = true;
      try {
        process.on("SIGINT", () => {
          this.teardown();
          process.exit(130);
        });
      } catch {
        // Ignore if unsupported environment
      }
    }

    this.render();
  }

  public getCallback(storeId: string): StoreProgressCallback {
    return (update) => {
      const state = this.stores.get(storeId);
      if (!state) return;

      if (update.page !== undefined) state.currentPage = update.page;
      if (update.totalPages !== undefined) state.totalPages = Math.max(1, update.totalPages);
      if (update.itemsCount !== undefined) state.itemsSynced = update.itemsCount;
      if (update.matchedCount !== undefined) state.matchedCount = update.matchedCount;
      if (update.status !== undefined) state.status = update.status;
      else if (state.status === "idle") state.status = "running";
      if (update.message !== undefined) state.message = update.message;

      this.render(storeId);
    };
  }

  public startStore(storeId: string): void {
    const state = this.stores.get(storeId);
    if (!state) return;
    state.status = "running";
    this.render(storeId);
  }

  public completeStore(
    storeId: string,
    stats: { totalSynced: number; matchedCount: number; durationSec: number }
  ): void {
    const state = this.stores.get(storeId);
    if (!state) return;
    state.status = "completed";
    state.itemsSynced = stats.totalSynced;
    state.matchedCount = stats.matchedCount;
    state.durationSec = stats.durationSec;
    state.currentPage = state.totalPages;
    state.message = undefined;
    this.render(storeId, true);
  }

  public failStore(storeId: string, error: string): void {
    const state = this.stores.get(storeId);
    if (!state) return;
    state.status = "failed";
    state.error = error;
    state.message = undefined;
    this.render(storeId, true);
  }

  public teardown(): void {
    if (this.isTTY) {
      this.stream.write("\x1b[?25h"); // Restore cursor
    }
  }

  public render(updatedStoreId?: string, forceLogNonTty = false): void {
    if (this.isTTY) {
      this.renderTty();
    } else if (updatedStoreId) {
      this.renderNonTty(updatedStoreId, forceLogNonTty);
    }
  }

  private renderTty(): void {
    const lines: string[] = [];
    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);

    lines.push(`\x1b[1m🔄 Marketplace Synchronization in Progress [${elapsedSec}s]\x1b[0m`);
    lines.push("");

    const maxNameLength = Math.max(
      15,
      ...this.storeOrder.map((id) => this.stores.get(id)?.storeName.length || 0)
    );

    let completedCount = 0;
    let totalItemsAllStores = 0;

    for (const id of this.storeOrder) {
      const s = this.stores.get(id);
      if (!s) continue;

      if (s.status === "completed" || s.status === "failed") {
        completedCount += 1;
      }
      totalItemsAllStores += s.itemsSynced;

      const paddedName = s.storeName.padEnd(maxNameLength);
      const ratio = s.totalPages > 0 ? s.currentPage / s.totalPages : 0;
      const bar = renderProgressBar(s.status === "completed" ? 1 : ratio, 14);

      let statusIcon = " ";
      let detail = "";

      if (s.status === "idle") {
        statusIcon = "⚪";
        detail = "Pending...";
      } else if (s.status === "running") {
        statusIcon = "⏳";
        detail = `Page ${s.currentPage}/${s.totalPages} (${s.itemsSynced} items)`;
        if (s.message) detail += ` · ${s.message}`;
      } else if (s.status === "retrying") {
        statusIcon = "🔄";
        detail = `Page ${s.currentPage}/${s.totalPages} · ${s.message || "Retrying..."}`;
      } else if (s.status === "completed") {
        statusIcon = "✔";
        detail = `Synced ${s.itemsSynced} items (${formatDuration(s.durationSec)})`;
      } else if (s.status === "failed") {
        statusIcon = "✖";
        detail = `Failed: ${s.error || "Unknown error"}`;
      }

      lines.push(`  ${statusIcon} ${bar}  \x1b[36m${paddedName}\x1b[0m  ${detail}`);
    }

    lines.push("");
    lines.push(
      `\x1b[90mProgress: ${completedCount}/${this.storeOrder.length} stores finished · ${totalItemsAllStores} listings parsed\x1b[0m`
    );

    // Overwrite previous output
    if (!this.renderedOnce) {
      this.stream.write("\x1b[?25l"); // Hide cursor
      this.stream.write(lines.join("\n") + "\n");
      this.renderedOnce = true;
      this.previousLinesCount = lines.length;
    } else {
      // Move cursor up to overwrite previous frame
      this.stream.write(`\x1b[${this.previousLinesCount}A`);
      for (const line of lines) {
        this.stream.write(`\x1b[2K\r${line}\n`);
      }
      this.previousLinesCount = lines.length;
    }
  }

  private renderNonTty(storeId: string, force: boolean): void {
    const s = this.stores.get(storeId);
    if (!s) return;

    const last = this.lastLoggedMilestone.get(storeId) ?? -1;
    const currentMilestone = s.currentPage;

    // Log on start, every 5 pages, completion, or failure
    const shouldLog =
      force ||
      s.status === "completed" ||
      s.status === "failed" ||
      s.status === "retrying" ||
      last === -1 ||
      (currentMilestone > 0 && currentMilestone % 5 === 0 && currentMilestone !== last);

    if (!shouldLog) return;

    this.lastLoggedMilestone.set(storeId, currentMilestone);
    const tag = `[${s.storeName}]`;

    if (s.status === "completed") {
      this.stream.write(
        `✔ ${tag} Completed: ${s.itemsSynced} listings synced, ${s.matchedCount} matched in ${formatDuration(
          s.durationSec
        )}\n`
      );
    } else if (s.status === "failed") {
      this.stream.write(`✖ ${tag} Failed: ${s.error || "Error"}\n`);
    } else if (s.status === "retrying") {
      this.stream.write(`🔄 ${tag} Page ${s.currentPage}/${s.totalPages}: ${s.message || "Retrying..."}\n`);
    } else if (s.status === "running") {
      const pct = s.totalPages > 0 ? Math.round((s.currentPage / s.totalPages) * 100) : 0;
      this.stream.write(`⏳ ${tag} Page ${s.currentPage}/${s.totalPages} (${pct}%) — ${s.itemsSynced} items\n`);
    }
  }

  public printFinalSummary(): void {
    this.teardown();

    const elapsedSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const divider = "═".repeat(64);
    const thinDivider = "─".repeat(64);

    const lines: string[] = [];
    lines.push("\n" + divider);
    lines.push("           Marketplace Synchronization Summary");
    lines.push(thinDivider);

    let totalSyncedAll = 0;
    let totalMatchedAll = 0;
    let successCount = 0;

    for (const id of this.storeOrder) {
      const s = this.stores.get(id);
      if (!s) continue;

      const isSuccess = s.status === "completed";
      const icon = isSuccess ? "✔" : "✖";
      const name = s.storeName.padEnd(20);

      if (isSuccess) {
        successCount += 1;
        totalSyncedAll += s.itemsSynced;
        totalMatchedAll += s.matchedCount;
        lines.push(`  ${icon} ${name}  ${s.itemsSynced} synced, ${s.matchedCount} matched (${formatDuration(s.durationSec)})`);
      } else {
        lines.push(`  ${icon} ${name}  FAILED: ${s.error || "Unknown error"}`);
      }
    }

    lines.push(thinDivider);
    lines.push(
      `Finished ${successCount}/${this.storeOrder.length} stores · Total: ${totalSyncedAll} synced (${totalMatchedAll} matched) in ${elapsedSec}s`
    );
    lines.push(divider + "\n");

    this.stream.write(lines.join("\n"));
  }
}

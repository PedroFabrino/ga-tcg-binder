import { getUserById } from "@/db/repositories/settings-repository";
import {
  getPendingWatchlistByUser,
  updateWatchlistEntry,
  deleteWatchlistItemsByIds,
} from "@/db/repositories/watchlist-repository";
import { decryptMypPassword } from "@/lib/crypto";

export interface FlareSolverrRequestOptions {
  method?: string;
  url: string;
  postData?: string;
  session?: string;
  headers?: Record<string, string>;
}

export interface FlareSolverrResponse {
  status: string | number;
  message?: string;
  solution?: {
    url: string;
    status: number;
    response: string;
    headers?: Record<string, string>;
    cookies?: Array<{ name: string; value: string }>;
  };
}

export interface FlareSolverrTransport {
  createSession(): Promise<string | { session?: string }>;
  destroySession(sessionId: string): Promise<void>;
  request(options: FlareSolverrRequestOptions): Promise<FlareSolverrResponse>;
}

export function createDefaultFlareSolverrTransport(endpoint = "http://localhost:8191/v1"): FlareSolverrTransport {
  return {
    async createSession(): Promise<string> {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.create" }),
      });
      const data = (await res.json()) as { session?: string; status?: string };
      if (!data?.session) {
        throw new Error("FlareSolverr failed to create session");
      }
      return data.session;
    },

    async destroySession(sessionId: string): Promise<void> {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd: "sessions.destroy", session: sessionId }),
        });
      } catch {
        // Ignore session destroy errors
      }
    },

    async request(options: FlareSolverrRequestOptions): Promise<FlareSolverrResponse> {
      const cmd = options.method?.toUpperCase() === "POST" ? "request.post" : "request.get";
      const payload: Record<string, unknown> = {
        cmd,
        url: options.url,
        session: options.session,
        headers: options.headers,
      };
      if (options.postData) {
        payload.postData = options.postData;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return (await res.json()) as FlareSolverrResponse;
    },
  };
}

export interface WatchlistRunnerOptions {
  database?: unknown;
  transport?: FlareSolverrTransport;
  pacingMs?: number;
}

export interface WatchlistRunnerResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  addsExecuted?: number;
  updatesExecuted?: number;
  removesExecuted?: number;
  error?: string;
}

/**
 * Executes queued Watchlist mutations against MyP Cards in an isolated FlareSolverr session
 * using the user's decrypted at-rest credentials.
 */
export async function executeAutomatedWatchlistSync(
  userId: string,
  options: WatchlistRunnerOptions = {}
): Promise<WatchlistRunnerResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repositories accept in-memory test database or singleton db
  const database = options.database as any;
  const transport = options.transport || createDefaultFlareSolverrTransport();
  const pacingMs = options.pacingMs ?? 500;

  const user = await getUserById(userId, database);

  if (!user || !user.mypLogin || !user.mypPasswordEncrypted) {
    return {
      success: true,
      skipped: true,
      reason: "missing_credentials",
    };
  }

  // Fetch pending mutations
  const pendingRows = await getPendingWatchlistByUser(userId, database);

  if (!pendingRows || pendingRows.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "no_pending_items",
    };
  }

  // Decrypt password in memory
  let passwordPlaintext: string;
  try {
    passwordPlaintext = decryptMypPassword(user.mypPasswordEncrypted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Decryption failed";
    return {
      success: false,
      error: `Failed to decrypt user credentials: ${message}`,
    };
  }

  let sessionId: string | null = null;
  let addsExecuted = 0;
  let updatesExecuted = 0;
  let removesExecuted = 0;

  try {
    const sessionRes = await transport.createSession();
    sessionId = typeof sessionRes === "string" ? sessionRes : (sessionRes?.session ?? "");

    // 1. Authenticate session on MyP Cards
    const loginPageRes = await transport.request({
      method: "GET",
      url: "https://mypcards.com/login",
      session: sessionId,
    });

    const loginHtml = loginPageRes.solution?.response || "";
    const csrfMatch =
      loginHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/) ||
      loginHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    const loginForm = new URLSearchParams({
      _csrf: csrfToken,
      "LoginForm[username]": user.mypLogin,
      "LoginForm[password]": passwordPlaintext,
      "LoginForm[rememberMe]": "1",
    });

    const loginSubmitRes = await transport.request({
      method: "POST",
      url: "https://mypcards.com/site/login",
      session: sessionId,
      postData: loginForm.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (loginSubmitRes.status !== 200 && loginSubmitRes.status !== 302) {
      throw new Error(`MyP login failed with status ${loginSubmitRes.status}`);
    }

    // 2. Execute pending mutations with polite pacing
    for (const item of pendingRows) {
      if (pacingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pacingMs));
      }

      if (item.status === "pending_add") {
        if (item.mypItemId) {
          const res = await transport.request({
            method: "POST",
            url: "https://mypcards.com/usuario/salvar-item",
            session: sessionId,
            postData: new URLSearchParams({
              _csrf: csrfToken,
              itemId: item.mypItemId,
              tipo: "C",
              quantidade: String(item.targetQuantity || 1),
              valor: item.targetPriceBrl ? item.targetPriceBrl.toFixed(2).replace(".", ",") : "1,00",
            }).toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });

          if (res?.status === 200) {
            await updateWatchlistEntry(
              item.id,
              {
                status: "watching",
                syncedQuantity: item.targetQuantity,
              },
              database
            );
            addsExecuted++;
          }
        }
      } else if (item.status === "pending_update") {
        if (item.mypItemId) {
          const res = await transport.request({
            method: "POST",
            url: "https://mypcards.com/usuario/salvar-item",
            session: sessionId,
            postData: new URLSearchParams({
              _csrf: csrfToken,
              itemId: item.mypItemId,
              tipo: "C",
              quantidade: String(item.targetQuantity || 1),
            }).toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });

          if (res?.status === 200) {
            await updateWatchlistEntry(
              item.id,
              {
                status: "watching",
                syncedQuantity: item.targetQuantity,
              },
              database
            );
            updatesExecuted++;
          }
        }
      } else if (item.status === "pending_remove") {
        if (item.mypItemId) {
          const res = await transport.request({
            method: "POST",
            url: "https://mypcards.com/usuario/remover-item",
            session: sessionId,
            postData: new URLSearchParams({
              _csrf: csrfToken,
              itemId: item.mypItemId,
              tipo: "C",
            }).toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });

          if (res?.status === 200) {
            await deleteWatchlistItemsByIds(item.userId, [item.id], database);
            removesExecuted++;
          }
        }
      }
    }

    return {
      success: true,
      addsExecuted,
      updatesExecuted,
      removesExecuted,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to execute automated watchlist mutations";
    return {
      success: false,
      error: message,
    };
  } finally {
    if (sessionId) {
      await transport.destroySession(sessionId);
    }
  }
}

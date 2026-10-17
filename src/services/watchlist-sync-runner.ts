import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { users, mypWatchlist, type WatchlistStatus } from "../db/schema";
import { decryptMypPassword } from "../lib/crypto";

export interface FlareSolverrTransport {
  createSession: () => Promise<{ session: string }>;
  destroySession: (session: string) => Promise<any>;
  request: (options: {
    method: "GET" | "POST";
    url: string;
    session?: string;
    postData?: string;
    headers?: Record<string, string>;
  }) => Promise<{ status: number; response: string }>;
}

/**
 * Default FlareSolverr HTTP transport.
 */
function createDefaultFlareSolverrTransport(
  flareUrl = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1"
): FlareSolverrTransport {
  return {
    createSession: async () => {
      const res = await fetch(flareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.create" }),
      });
      if (!res.ok) throw new Error(`FlareSolverr session creation failed: ${res.statusText}`);
      const data = await res.json();
      return { session: data.session };
    },
    destroySession: async (session: string) => {
      try {
        await fetch(flareUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd: "sessions.destroy", session }),
        });
      } catch {
        // Ignore destroy cleanup errors
      }
    },
    request: async (options) => {
      const res = await fetch(flareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: options.method === "POST" ? "request.post" : "request.get",
          url: options.url,
          session: options.session,
          postData: options.postData,
          headers: options.headers,
        }),
      });
      const data = await res.json();
      return {
        status: data.status || 200,
        response: data.solution?.response || "",
      };
    },
  };
}

export interface WatchlistRunnerOptions {
  database?: any;
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
  const database = options.database || db;
  const transport = options.transport || createDefaultFlareSolverrTransport();
  const pacingMs = options.pacingMs ?? 500;

  const user = await database
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user || !user.mypLogin || !user.mypPasswordEncrypted) {
    return {
      success: true,
      skipped: true,
      reason: "missing_credentials",
    };
  }

  // Fetch pending mutations
  const pendingRows = await database
    .select()
    .from(mypWatchlist)
    .where(
      and(
        eq(mypWatchlist.userId, userId),
        inArray(mypWatchlist.status, ["pending_add", "pending_update", "pending_remove"])
      )
    );

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
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to decrypt MyP credentials: ${err.message}`,
    };
  }

  let sessionId: string | null = null;
  let addsExecuted = 0;
  let updatesExecuted = 0;
  let removesExecuted = 0;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const sessionRes = await transport.createSession();
    sessionId = sessionRes.session;

    // Login to MyP Cards
    const loginRes = await transport.request({
      method: "POST",
      url: "https://mypcards.com/site/login",
      session: sessionId,
      postData: new URLSearchParams({
        "LoginForm[username]": user.mypLogin,
        "LoginForm[password]": passwordPlaintext,
        "LoginForm[rememberMe]": "1",
      }).toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const loginHtml = loginRes.response || "";
    const csrfMatch =
      loginHtml.match(/name="csrf-token"\s+content="([^"]+)"/i) ||
      loginHtml.match(/name="_csrf"\s+value="([^"]+)"/i);
    const csrfToken = csrfMatch ? csrfMatch[1] : "default_csrf";

    // Execute mutations with pacing
    for (const item of pendingRows) {
      await sleep(pacingMs);

      if (item.status === "pending_add") {
        if (item.mypItemId) {
          const res = await transport.request({
            method: "POST",
            url: "https://mypcards.com/usuario/salvar-item",
            session: sessionId,
            postData: new URLSearchParams({
              _csrf: csrfToken,
              itemId: item.mypItemId,
              tipo: "C", // Quero
              quantidade: String(item.targetQuantity || 1),
              preco: (item.targetPriceBrl || 1).toFixed(2).replace(".", ","),
              qualidade: "NM",
              idioma: "EN",
              foil: "0",
            }).toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });

          if (res?.status === 200) {
            await database
              .update(mypWatchlist)
              .set({
                status: "watching",
                updatedAt: sql`(strftime('%s', 'now'))`,
              })
              .where(eq(mypWatchlist.id, item.id));

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
            await database
              .update(mypWatchlist)
              .set({
                status: "watching",
                updatedAt: sql`(strftime('%s', 'now'))`,
              })
              .where(eq(mypWatchlist.id, item.id));

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
            await database
              .update(mypWatchlist)
              .set({
                status: "removed",
                updatedAt: sql`(strftime('%s', 'now'))`,
              })
              .where(eq(mypWatchlist.id, item.id));

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
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to execute automated watchlist mutations",
    };
  } finally {
    if (sessionId) {
      await transport.destroySession(sessionId);
    }
  }
}

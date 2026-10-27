import { isCloudflareChallenge as baseIsCloudflareChallenge } from "./market-crawl";
import {
  loadStoreSession,
  executeStoreFetch,
  SessionExpiredError,
  isSessionExpiredError,
} from "./store-session";

export { SessionExpiredError, isSessionExpiredError };

export const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": DEFAULT_BROWSER_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/**
 * Detects whether the response content represents a Cloudflare Turnstile,
 * interstitial, or bot challenge.
 */
export function isCloudflareChallenge(text: string): boolean {
  if (!text) return false;
  return (
    baseIsCloudflareChallenge(text) ||
    text.includes("Attention Required! | Cloudflare") ||
    text.includes('id="challenge-form"') ||
    text.includes("cf-browser-verification")
  );
}

export interface StoreFetchConfig {
  storeId?: string;
  solveCloudflare?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

const storeConfigs: Record<string, StoreFetchConfig> = {};

/**
 * Returns the effective fetch and retry configuration for a store, falling back
 * to safe defaults when not explicitly configured.
 */
export function getStoreFetchConfig(storeId?: string): StoreFetchConfig {
  if (!storeId) {
    return {
      solveCloudflare: true,
      maxRetries: 3,
      retryDelayMs: 3000,
      timeoutMs: 30000,
    };
  }
  const custom = storeConfigs[storeId.toLowerCase()] || {};
  return {
    storeId,
    solveCloudflare: custom.solveCloudflare ?? true,
    maxRetries: custom.maxRetries ?? 3,
    retryDelayMs: custom.retryDelayMs ?? 3000,
    timeoutMs: custom.timeoutMs ?? 30000,
  };
}

/**
 * Configures per-store fetching options (e.g. enabling or disabling FlareSolverr,
 * custom retry count, or backoff timing).
 */
export function setStoreFetchConfig(
  storeId: string,
  config: Partial<StoreFetchConfig>
): void {
  const key = storeId.toLowerCase();
  storeConfigs[key] = {
    ...getStoreFetchConfig(storeId),
    ...config,
    storeId,
  };
}

/** Resets all custom per-store fetch configurations (primarily for tests). */
export function resetStoreFetchConfigs(): void {
  for (const key of Object.keys(storeConfigs)) {
    delete storeConfigs[key];
  }
}

/**
 * Sends a request to FlareSolverr to solve a Cloudflare challenge and returns
 * the rendered page HTML. Returns null when FlareSolverr is unconfigured, unreachable,
 * or unable to solve the challenge.
 */
export async function solveWithFlareSolverr(
  url: string,
  options?: {
    flareUrl?: string;
    timeoutMs?: number;
    customFetch?: typeof fetch;
  }
): Promise<string | null> {
  const flareEndpoint = options?.flareUrl || process.env.FLARESOLVERR_URL;
  if (!flareEndpoint) {
    return null;
  }

  const normalized = flareEndpoint.replace(/\/+$/, "");
  const targetUrl = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  const fetchFn = options?.customFetch || fetch;

  try {
    const res = await fetchFn(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url,
        maxTimeout: options?.timeoutMs ?? 60000,
      }),
      signal: AbortSignal.timeout((options?.timeoutMs ?? 60000) + 5000),
    });

    if (!res.ok) {
      console.warn(`[FlareSolverr] Request returned HTTP ${res.status} for ${url}`);
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      solution?: { response?: string };
    };

    if (data?.status === "ok" && data.solution?.response) {
      return data.solution.response;
    }

    console.warn(`[FlareSolverr] Solver did not return solution for ${url}`);
    return null;
  } catch (err) {
    console.warn(
      `[FlareSolverr] Connection or solving error for ${url}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export async function fetchWithCurl(
  url: string,
  headers?: Record<string, string>,
  timeoutSec = 25
): Promise<string> {
  const { execFileSync } = await import("node:child_process");
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const headerArgs: string[] = [];
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      headerArgs.push("-H", `${k}: ${v}`);
    }
  }
  return execFileSync(
    curlBin,
    [
      "-sS",
      "-L",
      "--max-time",
      String(timeoutSec),
      "-A",
      DEFAULT_BROWSER_USER_AGENT,
      ...headerArgs,
      url,
    ],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );
}

export interface FetchWithRetryOptions extends StoreFetchConfig {
  customFetch?: typeof fetch;
  headers?: Record<string, string>;
}

/**
 * Fetches a URL with configurable retries, linear/exponential backoff, Cloudflare
 * challenge detection, and optional FlareSolverr solving.
 */
export async function fetchWithRetry(
  url: string,
  options?: FetchWithRetryOptions
): Promise<string> {
  const storeConfig = getStoreFetchConfig(options?.storeId);
  const solveCloudflare = options?.solveCloudflare ?? storeConfig.solveCloudflare ?? true;
  const maxRetries = options?.maxRetries ?? storeConfig.maxRetries ?? 3;
  const isTest = Boolean(options?.customFetch);
  const session = options?.storeId && !isTest ? loadStoreSession(options.storeId) : null;

  if (session) {
    try {
      return await executeStoreFetch(url, {
        session,
        timeoutSec: Math.ceil((options?.timeoutMs ?? storeConfig.timeoutMs ?? 30000) / 1000),
      });
    } catch (err) {
      if (isSessionExpiredError(err)) {
        throw err;
      }
      throw err;
    }
  }

  const retryDelayMs =
    options?.retryDelayMs ?? (isTest ? 10 : storeConfig.retryDelayMs ?? 3000);
  const timeoutMs = options?.timeoutMs ?? storeConfig.timeoutMs ?? 30000;
  const fetchFn = options?.customFetch || fetch;
  const headers = { ...DEFAULT_BROWSER_HEADERS, ...(options?.headers || {}) };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchFn(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        const text = await response.text();
        if (!isCloudflareChallenge(text)) {
          return text;
        }

        console.warn(
          `[fetchWithRetry] Cloudflare challenge detected on 200 response for ${url} (attempt ${attempt}/${maxRetries})`
        );
      } else {
        console.warn(
          `[fetchWithRetry] Request failed with HTTP ${response.status} for ${url} (attempt ${attempt}/${maxRetries})`
        );
      }

      // If Node fetch was blocked with 403 or challenge, attempt curl fallback (often bypasses Node TLS fingerprint blocks)
      if (!options?.customFetch) {
        try {
          const curlText = await fetchWithCurl(url, headers, Math.ceil(timeoutMs / 1000));
          if (curlText && !isCloudflareChallenge(curlText)) {
            return curlText;
          }
        } catch {
          // Fall through to FlareSolverr / retry
        }
      }

      // If challenge detected or non-2xx status, try FlareSolverr if enabled
      if (solveCloudflare && process.env.FLARESOLVERR_URL) {
        console.log(`[fetchWithRetry] Attempting FlareSolverr solve for ${url}...`);
        const solvedHtml = await solveWithFlareSolverr(url, {
          customFetch: options?.customFetch,
          timeoutMs: 60000,
        });

        if (solvedHtml && !isCloudflareChallenge(solvedHtml)) {
          return solvedHtml;
        }
      }

      lastError = new Error(
        `Request returned HTTP ${response.status} or Cloudflare challenge for ${url}`
      );
    } catch (err: unknown) {
      if (isSessionExpiredError(err)) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[fetchWithRetry] Network or timeout error for ${url} (attempt ${attempt}/${maxRetries}): ${lastError.message}`
      );

      // On network failure or timeout in real runtime, attempt curl
      if (!options?.customFetch) {
        try {
          const curlText = await fetchWithCurl(url, headers, Math.ceil(timeoutMs / 1000));
          if (curlText && !isCloudflareChallenge(curlText)) {
            return curlText;
          }
        } catch {
          // Fall through
        }
      }

      // On network failure or timeout, also try FlareSolverr if enabled
      if (solveCloudflare && process.env.FLARESOLVERR_URL) {
        try {
          const solvedHtml = await solveWithFlareSolverr(url, {
            customFetch: options?.customFetch,
            timeoutMs: 60000,
          });
          if (solvedHtml && !isCloudflareChallenge(solvedHtml)) {
            return solvedHtml;
          }
        } catch {
          // Continue to retry backoff
        }
      }
    }

    if (attempt < maxRetries) {
      const backoffMs = retryDelayMs * attempt;
      await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(
    `Failed to fetch ${url} after ${maxRetries} attempt(s): ${lastError?.message || "Unknown error"}`
  );
}

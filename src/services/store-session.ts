import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { isCloudflareChallenge } from "./market-request-helper";

export class SessionExpiredError extends Error {
  readonly isSessionExpired = true;
  readonly storeId: string;
  readonly status?: number;

  constructor(storeId: string, message: string, status?: number) {
    super(message);
    this.name = "SessionExpiredError";
    this.storeId = storeId;
    this.status = status;
  }
}

export function isSessionExpiredError(err: unknown): err is SessionExpiredError {
  return (
    err instanceof Error &&
    (err as any).isSessionExpired === true &&
    typeof (err as any).storeId === "string"
  );
}

export interface StoreSession {
  storeId: string;
  cookie: string;
  userAgent: string;
  headers?: Record<string, string>;
}

export function maskCookie(cookie: string): string {
  if (!cookie) return "[empty]";
  if (cookie.length < 15) return "[set]";
  const start = cookie.slice(0, 15);
  const end = cookie.slice(-4);
  return `${start}...${end} (length: ${cookie.length})`;
}

export function deriveClientHints(userAgent: string): Record<string, string> {
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/i);
  const chromeVersion = chromeMatch?.[1] || "124";

  let platform = "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    platform = "macOS";
  } else if (/Android/i.test(userAgent)) {
    platform = "Android";
  } else if (/Linux/i.test(userAgent)) {
    platform = "Linux";
  }

  const isMobile = /Android|Mobile/i.test(userAgent);

  return {
    "Sec-Ch-Ua": `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not-A.Brand";v="99"`,
    "Sec-Ch-Ua-Mobile": isMobile ? "?1" : "?0",
    "Sec-Ch-Ua-Platform": `"${platform}"`,
  };
}

export function loadStoreSession(
  storeId: string,
  options?: {
    sessionDir?: string;
    env?: Record<string, string | undefined>;
    fs?: {
      existsSync: (path: string) => boolean;
      readFileSync: (path: string, encoding: string) => string;
    };
  }
): StoreSession | null {
  const normalizedId = storeId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const envObj = options?.env ?? process.env;
  const fsObj = options?.fs ?? fs;

  // 1. Check file in session directory
  const sessionDir =
    options?.sessionDir ||
    envObj.STORE_SESSION_DIR ||
    (fsObj.existsSync("/app/secrets") ? "/app/secrets" : path.resolve(process.cwd(), ".secrets"));

  const candidates = [
    path.join(sessionDir, `${normalizedId}.json`),
    path.join(sessionDir, `${normalizedId}.session`),
    path.join(sessionDir, `${normalizedId}.cookie`),
    path.join(sessionDir, `${storeId.toLowerCase()}.json`),
    path.join(sessionDir, `${storeId.toLowerCase()}.session`),
    path.join(sessionDir, `${storeId.toLowerCase()}.cookie`),
  ];

  for (const filePath of candidates) {
    if (fsObj.existsSync(filePath)) {
      try {
        const raw = fsObj.readFileSync(filePath, "utf-8").trim();
        if (filePath.endsWith(".json") || raw.startsWith("{")) {
          const parsed = JSON.parse(raw);
          if (parsed.cookie) {
            const ua =
              parsed.userAgent ||
              parsed.ua ||
              envObj.LIGA_USER_AGENT ||
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
            return {
              storeId,
              cookie: parsed.cookie,
              userAgent: ua,
              headers: deriveClientHints(ua),
            };
          }
        } else {
          // Key-value or plain cookie string
          let cookie = "";
          let ua = "";
          const lines = raw.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("COOKIE=") || trimmed.startsWith("cookie=")) {
              cookie = trimmed.slice(7).trim();
            } else if (trimmed.startsWith("UA=") || trimmed.startsWith("USER_AGENT=")) {
              ua = trimmed.slice(trimmed.indexOf("=") + 1).trim();
            }
          }
          if (!cookie) {
            cookie = raw;
          }
          if (cookie) {
            const effectiveUa =
              ua ||
              envObj.LIGA_USER_AGENT ||
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
            return {
              storeId,
              cookie,
              userAgent: effectiveUa,
              headers: deriveClientHints(effectiveUa),
            };
          }
        }
      } catch {
        // Continue to check env vars
      }
    }
  }

  // 2. Check environment variables
  const envKey = normalizedId.toUpperCase();
  const cookieEnv =
    envObj[`LIGA_COOKIE_${envKey}`] ||
    envObj[`COOKIE_${envKey}`] ||
    envObj[`LIGA_COOKIE_${storeId.toUpperCase()}`];

  if (cookieEnv) {
    const uaEnv =
      envObj[`LIGA_UA_${envKey}`] ||
      envObj[`UA_${envKey}`] ||
      envObj.LIGA_USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    return {
      storeId,
      cookie: cookieEnv,
      userAgent: uaEnv,
      headers: deriveClientHints(uaEnv),
    };
  }

  return null;
}

const HTTP_STATUS_MARKER = "\n__HTTP_STATUS__:";

export async function executeStoreFetch(
  url: string,
  options: {
    session: StoreSession;
    timeoutSec?: number;
    referer?: string;
    execFileFn?: typeof execFile;
  }
): Promise<string> {
  const { session } = options;
  const timeoutSec = options.timeoutSec ?? 30;
  const execFn = options.execFileFn ?? execFile;

  // Determine curl executable: prefer curl_chrome152 if available, else curl.exe / curl
  let curlBin = "curl_chrome152";
  if (process.platform === "win32") {
    curlBin = "curl.exe";
  }

  const clientHints = session.headers || deriveClientHints(session.userAgent);
  const args = [
    "-s",
    "--compressed",
    "--max-time",
    String(timeoutSec),
    "-w",
    `${HTTP_STATUS_MARKER}%{http_code}`,
    "-H",
    `User-Agent: ${session.userAgent}`,
    "-H",
    "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "-H",
    "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "-H",
    `Cookie: ${session.cookie}`,
  ];

  if (options.referer) {
    args.push("-H", `Referer: ${options.referer}`);
  }

  for (const [k, v] of Object.entries(clientHints)) {
    args.push("-H", `${k}: ${v}`);
  }

  args.push(url);

  return new Promise<string>((resolve, reject) => {
    execFn(curlBin, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        // If curl_chrome152 failed to launch (e.g. not found on host outside docker), try standard curl
        if (curlBin === "curl_chrome152") {
          execFn("curl", args, { maxBuffer: 15 * 1024 * 1024 }, (fallbackErr, fallbackStdout) => {
            if (fallbackErr && !fallbackStdout) {
              return reject(fallbackErr);
            }
            return handleResponse(fallbackStdout || "", session, url, resolve, reject);
          });
          return;
        }
        return reject(err);
      }

      handleResponse(stdout || "", session, url, resolve, reject);
    });
  });
}

function handleResponse(
  output: string,
  session: StoreSession,
  url: string,
  resolve: (value: string) => void,
  reject: (reason?: any) => void
) {
  const markerIdx = output.lastIndexOf(HTTP_STATUS_MARKER);
  let status = 200;
  let body = output;

  if (markerIdx !== -1) {
    body = output.slice(0, markerIdx);
    const parsedStatus = Number(output.slice(markerIdx + HTTP_STATUS_MARKER.length).trim());
    if (Number.isFinite(parsedStatus) && parsedStatus > 0) {
      status = parsedStatus;
    }
  }

  const isChallenge = isCloudflareChallenge(body);
  if (status === 403 || status === 429 || isChallenge) {
    console.warn(
      `[StoreSession: ${session.storeId}] Cloudflare session expired or challenged (HTTP ${status}, challenge=${isChallenge}) for ${url}. Please refresh session credentials.`
    );
    return reject(
      new SessionExpiredError(
        session.storeId,
        `Session expired or Cloudflare challenged for store "${session.storeId}" (HTTP ${status})`,
        status
      )
    );
  }

  if (status >= 400) {
    return reject(new Error(`HTTP ${status} returned for ${url}`));
  }

  resolve(body);
}

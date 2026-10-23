const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Per-request timeout. Slightly above Cloudflare's ~20s origin-timeout window so
 * upstream error statuses (e.g. 522) can be observed instead of being masked as
 * an opaque client timeout.
 */
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Fetches a marketplace page/JSON document, preferring the runtime `fetch` and
 * falling back to the `curl` binary when fetch fails. Errors include the
 * upstream HTTP status (when known) and curl's stderr so failures are
 * diagnosable instead of appearing as a generic command failure.
 */
export async function fetchMarketHtml(
  url: string,
  customFetch = fetch
): Promise<string> {
  let fetchStatus: number | null = null;

  try {
    const response = await customFetch(url, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return await response.text();
    }
    fetchStatus = response.status;
  } catch {
    // Fallback to curl below
  }

  const statusSuffix = fetchStatus ? ` (fetch HTTP ${fetchStatus})` : "";

  // A definitive 5xx from fetch means the curl fallback (intended for transport
  // or bot-blocking failures) would only repeat the same slow failure.
  if (fetchStatus !== null && (fetchStatus >= 500 || customFetch !== fetch)) {
    throw new Error(`Marketplace request failed for ${url}${statusSuffix}`);
  }

  const { execFileSync } = await import("node:child_process");
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";

  let stdout: string;
  try {
    stdout = execFileSync(
      curlBin,
      [
        "-sS",
        "-f",
        "-L",
        "--max-time",
        String(REQUEST_TIMEOUT_MS / 1000),
        "-A",
        BROWSER_USER_AGENT,
        url,
      ],
      { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
    );
  } catch (err) {
    const stderr = (err as { stderr?: unknown })?.stderr
      ? String((err as { stderr?: unknown }).stderr).trim()
      : "";
    const detail = stderr || "curl request failed";
    throw new Error(`Marketplace request failed for ${url}${statusSuffix}: ${detail}`);
  }

  if (!stdout || stdout.trim().length === 0) {
    throw new Error(`Empty response from ${url}`);
  }

  return stdout;
}

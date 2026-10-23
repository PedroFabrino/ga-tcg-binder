import { isTableCredentials, type TableCredentials } from "@ga/contracts";
import { gatewayBaseUrl } from "./gateway";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Create a Table on the gateway. The response is validated at the boundary so a
 * changed or broken deployment cannot hand the app a half-shaped credential set.
 */
export async function createTable(
  fetcher: FetchLike = fetch,
  baseUrl: string = gatewayBaseUrl()
): Promise<TableCredentials> {
  const endpoint = new URL("/api/table", baseUrl).toString();
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Table creation failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isTableCredentials(body)) {
    throw new Error("Table creation returned an unexpected response");
  }

  return body;
}

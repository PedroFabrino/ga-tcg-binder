/**
 * Client for GitBook Streamable HTTP MCP (Grand Archive Rules).
 */

export interface McpContentItem {
  type: string;
  text?: string;
}

export interface McpToolCallResult {
  content?: McpContentItem[];
  isError?: boolean;
}

export interface JsonRpcMcpResponse {
  jsonrpc?: string;
  id?: number | string;
  result?: {
    content?: McpContentItem[];
  };
  error?: {
    code?: number;
    message?: string;
  };
}

export const DEFAULT_GA_RULES_MCP_URL = "https://rules.gatcg.com/~gitbook/mcp";

/**
 * Queries the official Grand Archive rules via GitBook MCP searchDocumentation tool.
 */
export async function queryOfficialRulesMcp(
  query: string,
  mcpUrl: string = DEFAULT_GA_RULES_MCP_URL,
  customFetch: typeof fetch = fetch
): Promise<{ success: boolean; text: string }> {
  try {
    const res = await customFetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "searchDocumentation",
          arguments: { query },
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[DeckAdvisor MCP] Request failed with status ${res.status}: ${res.statusText}`);
      return {
        success: false,
        text: `Unable to query official rules (HTTP ${res.status}).`,
      };
    }

    const raw = await res.text();
    // Parse SSE or JSON
    let parsedJson: JsonRpcMcpResponse | null = null;
    if (raw.includes("data:")) {
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (line) {
        try {
          parsedJson = JSON.parse(line.replace(/^data:\s*/, "").trim()) as JsonRpcMcpResponse;
        } catch (e: unknown) {
          console.warn("[DeckAdvisor MCP] Failed to parse SSE line data:", e);
        }
      }
    }

    if (!parsedJson) {
      try {
        parsedJson = JSON.parse(raw) as JsonRpcMcpResponse;
      } catch (e: unknown) {
        console.warn("[DeckAdvisor MCP] Failed to parse raw JSON-RPC response:", e);
      }
    }

    if (!parsedJson?.result?.content) {
      console.warn(`[DeckAdvisor MCP] No content returned from MCP tools/call.`);
      return {
        success: false,
        text: "Official rules endpoint returned no content for this query.",
      };
    }

    const items: McpContentItem[] = parsedJson.result.content;
    const extracted = items
      .filter((i) => i.type === "text" && i.text)
      .map((i) => i.text)
      .join("\n\n");

    return {
      success: true,
      text: extracted || "No matching official rules excerpt found.",
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[DeckAdvisor MCP] Failed to connect to GitBook MCP at ${mcpUrl}: ${message}`);
    return {
      success: false,
      text: `Rules MCP unavailable: ${message}`,
    };
  }
}

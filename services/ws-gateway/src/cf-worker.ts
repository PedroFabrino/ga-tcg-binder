import { CORS_HEADERS } from "./cors-headers";
import { generateTableCode } from "./table-credentials";
import { TableDO } from "./table-do";
import { tableCodeFromPath } from "./table-routes";
import { getIceServersResponse } from "./turn";

export { TableDO };

export interface Env {
  TABLE_DO: DurableObjectNamespace;
  TURN_URL?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };
const CREATE_ATTEMPTS = 3;

/**
 * Production gateway. Every Table lives in the Durable Object named by its
 * code, so two players always reach the same authority regardless of which
 * Cloudflare isolate handles their request.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          runtime: "cloudflare-workers",
          timestamp: Date.now(),
        }),
        { headers: JSON_HEADERS }
      );
    }

    if (url.pathname === "/turn") {
      const iceServers = getIceServersResponse({
        turnUrl: env.TURN_URL,
        turnUsername: env.TURN_USERNAME,
        turnCredential: env.TURN_CREDENTIAL,
      });
      return new Response(JSON.stringify(iceServers), {
        headers: JSON_HEADERS,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/table") {
      return createTable(env);
    }

    const code = tableCodeFromPath(url.pathname);
    if (code) {
      const stub = env.TABLE_DO.get(env.TABLE_DO.idFromName(code));
      return stub.fetch(request);
    }

    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      return new Response("Expected table code in path, e.g. /t/:code", {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};

/** Retries only on a code collision (the DO reports 409 when it already exists). */
async function createTable(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateTableCode();
    const stub = env.TABLE_DO.get(env.TABLE_DO.idFromName(code));
    const response = await stub.fetch(
      new Request(`http://do/init?code=${code}`, { method: "POST" })
    );
    if (response.status !== 409) {
      return new Response(await response.text(), {
        status: response.status,
        headers: JSON_HEADERS,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Could not allocate a table code" }), {
    status: 503,
    headers: JSON_HEADERS,
  });
}

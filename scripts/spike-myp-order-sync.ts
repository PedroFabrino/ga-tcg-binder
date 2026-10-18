import { createDefaultFlareSolverrTransport } from "../src/services/watchlist-sync-runner";
import { decryptMypPassword } from "../src/lib/crypto";
import { getUsersForAutomatedWatchlistSync } from "../src/db/repositories/settings-repository";
import { parseMypVendasHtml, parseMypOrderPageHtml } from "../src/services/fulfillment-parser";
import { runMigrations } from "../src/db/init";

interface SpikeReport {
  success: boolean;
  authenticated: boolean;
  userNickname: string;
  vendasPageFetched: boolean;
  ordersDiscoveredCount: number;
  discoveredOrders: Array<{
    orderId: string;
    orderDate: string;
    buyerNick: string;
    shippingMethod: string;
    status: string;
  }>;
  inspectedOrder?: {
    orderId: string;
    status: string;
    itemCount: number;
    shippingMethod: string;
    hasBuyerNick: boolean;
    hasRecipientAddressBox: boolean;
    totalAmountBrl?: number;
  };
  piiRedacted: boolean;
  mutationsPerformed: boolean;
  durationMs: number;
  error?: string;
}

async function resolveCredentials(): Promise<{ username: string; login: string; passwordPlaintext: string }> {
  // 1. Direct environment variable override (for manual test runs or CI inputs)
  if (process.env.MYP_LOGIN && process.env.MYP_PASSWORD) {
    return {
      username: process.env.MYP_USERNAME || process.env.MYP_LOGIN,
      login: process.env.MYP_LOGIN,
      passwordPlaintext: process.env.MYP_PASSWORD,
    };
  }

  // 2. Local database resolution
  await runMigrations();
  const users = await getUsersForAutomatedWatchlistSync();
  const user = users.find((u) => u.mypLogin && u.mypPasswordEncrypted);

  if (!user || !user.mypLogin || !user.mypPasswordEncrypted) {
    throw new Error(
      "No configured MyP credentials found. Provide MYP_LOGIN and MYP_PASSWORD in env or save them in Settings."
    );
  }

  const passwordPlaintext = decryptMypPassword(user.mypPasswordEncrypted);
  return {
    username: user.mypUsername || user.mypLogin,
    login: user.mypLogin,
    passwordPlaintext,
  };
}

async function runFeasibilitySpike(): Promise<SpikeReport> {
  const startTime = Date.now();
  const flareEndpoint = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";
  const normalizedEndpoint = flareEndpoint.endsWith("/v1") ? flareEndpoint : `${flareEndpoint}/v1`;
  const transport = createDefaultFlareSolverrTransport(normalizedEndpoint);

  const report: SpikeReport = {
    success: false,
    authenticated: false,
    userNickname: "",
    vendasPageFetched: false,
    ordersDiscoveredCount: 0,
    discoveredOrders: [],
    piiRedacted: true,
    mutationsPerformed: false,
    durationMs: 0,
  };

  let sessionId: string | null = null;

  try {
    console.log("==================================================");
    console.log("   MyP Cards Fulfillment Feasibility Spike (ADR 0014)");
    console.log("   Strictly Read-Only Mode (Zero Mutations)");
    console.log("==================================================\n");

    // 1. Sourcing credentials
    console.log("[1/5] Sourcing MyP credentials...");
    const creds = await resolveCredentials();
    report.userNickname = creds.username;
    console.log(`✓ Resolved credentials for user: ${creds.username}\n`);

    // 2. Establishing FlareSolverr session
    console.log(`[2/5] Connecting to FlareSolverr at ${normalizedEndpoint}...`);
    try {
      const sessionRes = await transport.createSession();
      sessionId = typeof sessionRes === "string" ? sessionRes : (sessionRes?.session ?? "");
      console.log(`✓ FlareSolverr session created: ${sessionId}\n`);
    } catch (err: unknown) {
      throw new Error(
        `Failed to reach FlareSolverr at ${normalizedEndpoint}.\n` +
          "If running locally, ensure the container is active:\n" +
          "  docker run -d --name flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest\n" +
          `Original error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 3. Authenticating on MyP Cards
    console.log("[3/5] Authenticating on MyP Cards...");
    const loginPage = await transport.request({
      method: "GET",
      url: "https://mypcards.com/login",
      session: sessionId,
    });

    const loginHtml = loginPage.solution?.response || "";
    // Extract the specific login form block (avoiding top navbar search forms)
    const loginFormBlockMatch =
      loginHtml.match(/<form[^>]*id=["']login-form["'][\s\S]*?<\/form>/i) ||
      loginHtml.match(/<form[^>]*>[\s\S]*?LoginForm[\s\S]*?<\/form>/i);
    const loginFormHtml = loginFormBlockMatch ? loginFormBlockMatch[0] : loginHtml;

    const csrfMatch =
      loginFormHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/) ||
      loginHtml.match(/value="([^"]+)"\s+name="_csrf(?:-frontend)?"/) ||
      loginHtml.match(/name="_csrf(?:-frontend)?"\s+value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    if (!csrfToken) {
      throw new Error("Could not extract CSRF token from https://mypcards.com/login");
    }

    const inputNames = Array.from(loginFormHtml.matchAll(/<input[^>]*name=["']([^"']+)["']/gi)).map((m) => m[1]);
    console.log("   └─ Detected login input fields:", inputNames.filter((n) => !n.includes("csrf")));

    const formActionMatch = loginFormHtml.match(/action=["']([^"']+)["']/i);
    let formAction = formActionMatch ? formActionMatch[1] : "/login";
    if (formAction === "#" || !formAction) formAction = "/login";
    const postUrl = formAction.startsWith("http")
      ? formAction
      : `https://mypcards.com${formAction.startsWith("/") ? "" : "/"}${formAction}`;
    console.log(`   └─ Submitting credentials to: ${postUrl}`);

    // Map username field dynamically if named LoginForm[username] or LoginForm[login]
    const userField = inputNames.find((n) => /LoginForm\[(username|login)\]/i.test(n)) || "LoginForm[username]";
    const passField = inputNames.find((n) => /LoginForm\[password\]/i.test(n)) || "LoginForm[password]";

    const loginForm = new URLSearchParams({
      _csrf: csrfToken,
      [userField]: creds.login,
      [passField]: creds.passwordPlaintext,
      "LoginForm[rememberMe]": "1",
    });

    const loginSubmitRes = await transport.request({
      method: "POST",
      url: postUrl,
      session: sessionId,
      postData: loginForm.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const submitHtml = loginSubmitRes.solution?.response || "";
    const submitUrl = loginSubmitRes.solution?.url || "";
    console.log(`   └─ Post-login landing URL: ${submitUrl}`);

    const errorMatch =
      submitHtml.match(/class=["'][^"']*help-block-error[^"']*["'][^>]*>([^<]+)/i) ||
      submitHtml.match(/class=["'][^"']*alert-danger[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (errorMatch) {
      const cleanError = errorMatch[1].replace(/<[^>]+>/g, " ").trim();
      throw new Error(`MyP login rejected with message: "${cleanError}"`);
    }

    report.authenticated = true;
    console.log("✓ Successfully authenticated session on MyP Cards.\n");

    // 4. Ingestion Discovery: GET /<username>/vendas
    console.log(`[4/5] Fetching orders discovery page (GET /${creds.username}/vendas)...`);
    const vendasRes = await transport.request({
      method: "GET",
      url: `https://mypcards.com/${creds.username}/vendas`,
      session: sessionId,
    });

    const vendasHtml = vendasRes.solution?.response || "";
    const isVendasSuccess =
      (vendasRes.status === "ok" || vendasRes.status === 200 || vendasRes.solution?.status === 200) &&
      !vendasHtml.includes("LoginForm[username]");

    report.vendasPageFetched = isVendasSuccess;
    if (!isVendasSuccess) {
      if (vendasHtml.includes("LoginForm[username]")) {
        throw new Error("Session was redirected to login. MyP credentials may be incorrect or session expired.");
      }
      throw new Error(`Failed to load vendas page: status ${vendasRes.status} (solution ${vendasRes.solution?.status})`);
    }

    const discovered = parseMypVendasHtml(vendasHtml, { includeEmSeparacao: true });
    report.ordersDiscoveredCount = discovered.length;
    report.discoveredOrders = discovered.map((d) => ({
      orderId: d.orderId,
      orderDate: d.orderDate,
      buyerNick: d.buyerNick,
      shippingMethod: d.shippingMethod,
      status: d.status,
    }));

    console.log(`✓ Discovered ${discovered.length} eligible fulfillment order(s).\n`);

    // 5. Ingestion Inspection: GET /pedido/<id>
    const targetOrderId = process.env.MYP_SPIKE_ORDER_ID || discovered[0]?.orderId;

    if (targetOrderId) {
      console.log(`[5/5] Fetching order inspection details (GET /pedido/${targetOrderId})...`);
      const pedidoRes = await transport.request({
        method: "GET",
        url: `https://mypcards.com/pedido/${targetOrderId}`,
        session: sessionId,
      });

      const pedidoHtml = pedidoRes.solution?.response || "";
      const parsedOrder = parseMypOrderPageHtml(pedidoHtml, targetOrderId);

      report.inspectedOrder = {
        orderId: parsedOrder.orderId,
        status: parsedOrder.status,
        itemCount: parsedOrder.items?.length ?? 0,
        shippingMethod: parsedOrder.shippingMethod,
        hasBuyerNick: Boolean(parsedOrder.buyerNick),
        hasRecipientAddressBox: Boolean(parsedOrder.buyer),
        totalAmountBrl: parsedOrder.totals?.totalCents ? parsedOrder.totals.totalCents / 100 : undefined,
      };

      console.log(`✓ Successfully extracted order #${targetOrderId}:`);
      console.log(`   └─ Status: ${parsedOrder.status}`);
      console.log(`   └─ Items: ${parsedOrder.items?.length ?? 0} item(s)`);
      console.log(`   └─ Shipping Method: ${parsedOrder.shippingMethod}`);
      console.log(`   └─ Recipient Address Box: ${parsedOrder.buyer ? "Present" : "Missing"}`);
      console.log(`   └─ PII Sanity: Redacted from logs.\n`);
    } else {
      console.log("[5/5] No orders present in vendas table to inspect. Skipping detail GET.");
    }

    report.success = report.authenticated && report.vendasPageFetched;
  } catch (err: unknown) {
    report.error = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Spike Execution Failed:", report.error);
  } finally {
    if (sessionId) {
      console.log("Cleaning up FlareSolverr session...");
      await transport.destroySession(sessionId).catch(() => {});
    }
    report.durationMs = Date.now() - startTime;
  }

  console.log("\n==================================================");
  console.log("             SPIKE EXECUTION REPORT               ");
  console.log("==================================================");
  console.log(JSON.stringify(report, null, 2));
  console.log("==================================================\n");

  if (!report.success) {
    process.exit(1);
  }

  return report;
}

runFeasibilitySpike().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

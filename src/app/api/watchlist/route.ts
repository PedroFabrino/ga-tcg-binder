import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import {
  getWatchlistSummaryService,
  updateWatchlistPoliciesService,
  reconcileUserWatchlist,
  reEnableWatchlistEntry,
} from "@/services/watchlist";
import { executeAutomatedWatchlistSync } from "@/services/watchlist-sync-runner";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const urlUserId = req?.nextUrl?.searchParams?.get("userId");
    const userId = urlUserId || session?.user?.id || DEFAULT_USER_ID;

    const data = await getWatchlistSummaryService(userId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "re_enable") {
      const watchlistId = typeof body.watchlistId === "string" ? body.watchlistId : body.entryId;
      if (!watchlistId || typeof watchlistId !== "string") {
        return NextResponse.json({ error: "Missing watchlistId" }, { status: 400 });
      }
      await reEnableWatchlistEntry(watchlistId);
      return NextResponse.json({ success: true });
    }

    if (action === "set_policy" || action === "update_policy") {
      const { policy, report } = await updateWatchlistPoliciesService(userId, {
        hard: typeof body.policyHard === "boolean" ? body.policyHard : body.policies?.hard,
        shared: typeof body.policyShared === "boolean" ? body.policyShared : body.policies?.shared,
        staples: typeof body.policyStaples === "boolean" ? body.policyStaples : body.policies?.staples,
        legacyPolicy: typeof body.policy === "string" ? body.policy : undefined,
      });

      return NextResponse.json({ success: true, policy, report });
    }

    if (action === "reconcile") {
      const report = await reconcileUserWatchlist(userId);
      return NextResponse.json({ success: true, report });
    }

    if (action === "sync_now") {
      await reconcileUserWatchlist(userId);
      const runnerRes = await executeAutomatedWatchlistSync(userId);
      return NextResponse.json({ success: true, runner: runnerRes });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

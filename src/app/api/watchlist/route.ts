import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, mypWatchlist } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import {
  getEffectiveQuotaPolicy,
  reconcileUserWatchlist,
  reEnableWatchlistEntry,
  summarizeWatchlistRows,
} from "@/services/watchlist";
import { executeAutomatedWatchlistSync } from "@/services/watchlist-sync-runner";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    // Prioritize authenticated session user to prevent IDOR
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    const items = await db.select().from(mypWatchlist).where(eq(mypWatchlist.userId, userId));

    const activePolicy = getEffectiveQuotaPolicy(user);
    const summaryCounts = summarizeWatchlistRows(items);

    return NextResponse.json({
      items,
      summary: {
        activePolicy,
        ...summaryCounts,
        hasSavedMypCredentials: Boolean(user?.mypPasswordEncrypted),
        mypUsername: user?.mypUsername || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = session?.user?.id || DEFAULT_USER_ID;
    const action = body.action;

    if (action === "re_enable" && body.watchlistId) {
      await reEnableWatchlistEntry(body.watchlistId, db);
      return NextResponse.json({ success: true });
    }

    if (action === "set_policy") {
      const updateData: any = {};
      if (body.policyHard !== undefined) updateData.watchlistPolicyHard = Boolean(body.policyHard);
      if (body.policyShared !== undefined) updateData.watchlistPolicyShared = Boolean(body.policyShared);
      if (body.policyStaples !== undefined) updateData.watchlistPolicyStaples = Boolean(body.policyStaples);

      if (body.policy) {
        if (body.policy === "shared") {
          updateData.watchlistPolicyHard = false;
          updateData.watchlistPolicyShared = true;
          updateData.watchlistPolicyStaples = false;
        } else if (body.policy === "staples") {
          updateData.watchlistPolicyHard = false;
          updateData.watchlistPolicyShared = false;
          updateData.watchlistPolicyStaples = true;
        } else {
          updateData.watchlistPolicyHard = true;
          updateData.watchlistPolicyShared = false;
          updateData.watchlistPolicyStaples = false;
        }
      }

      await db.update(users).set(updateData).where(eq(users.id, userId));
      await reconcileUserWatchlist(userId);
      return NextResponse.json({ success: true, policy: body.policy });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { encryptMypPassword } from "@/lib/crypto";
import { reconcileUserWatchlist } from "@/services/watchlist";

function sanitizeUser(user: any) {
  if (!user) return null;
  const { mypPasswordEncrypted, ...safeUser } = user;
  return {
    ...safeUser,
    hasSavedMypCredentials: Boolean(mypPasswordEncrypted),
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    // Prioritize authenticated session user, allow DEFAULT_USER_ID fallback in single-user dev mode
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    // Prioritize authenticated session user to prevent IDOR
    const userId = session?.user?.id || DEFAULT_USER_ID;
    const lowPopThreshold = body.lowPopThreshold !== undefined ? parseInt(body.lowPopThreshold, 10) : undefined;
    const name = body.name?.trim();
    const mypUsername = body.mypUsername !== undefined ? body.mypUsername?.trim() || null : undefined;

    const updateData: any = {};
    if (lowPopThreshold !== undefined && !isNaN(lowPopThreshold)) {
      updateData.lowPopThreshold = lowPopThreshold;
    }
    if (name) {
      updateData.name = name;
    }
    if (mypUsername !== undefined) {
      updateData.mypUsername = mypUsername;
    }

    // Quota policy updates
    if (body.watchlistPolicy) {
      if (body.watchlistPolicy === "shared") {
        updateData.watchlistPolicyHard = false;
        updateData.watchlistPolicyShared = true;
        updateData.watchlistPolicyStaples = false;
      } else if (body.watchlistPolicy === "staples") {
        updateData.watchlistPolicyHard = false;
        updateData.watchlistPolicyShared = false;
        updateData.watchlistPolicyStaples = true;
      } else {
        // hard
        updateData.watchlistPolicyHard = true;
        updateData.watchlistPolicyShared = false;
        updateData.watchlistPolicyStaples = false;
      }
    }

    // MyP credentials update
    if (body.clearMypCredentials) {
      updateData.mypLogin = null;
      updateData.mypPasswordEncrypted = null;
    } else if (body.mypPassword && typeof body.mypPassword === "string" && body.mypPassword.trim()) {
      updateData.mypPasswordEncrypted = encryptMypPassword(body.mypPassword.trim());
      if (body.mypLogin && typeof body.mypLogin === "string") {
        updateData.mypLogin = body.mypLogin.trim();
      }
    } else if (body.mypLogin && typeof body.mypLogin === "string") {
      updateData.mypLogin = body.mypLogin.trim();
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, userId));
    }

    // Trigger reconciliation if policy or credentials changed
    if (body.watchlistPolicy || body.mypUsername || body.mypPassword || body.clearMypCredentials) {
      try {
        await reconcileUserWatchlist(userId);
      } catch {
        // Ignore background reconciliation errors
      }
    }

    const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
    return NextResponse.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

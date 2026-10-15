import { NextRequest, NextResponse } from "next/server";
import { calculateAggregatedShortages } from "@/services/shortage";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    const report = await calculateAggregatedShortages(userId, db);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mypWatchlist } from "@/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;

    const confirmedAddIds: string[] = Array.isArray(body.confirmedAddIds) ? body.confirmedAddIds : [];
    const confirmedUpdateIds: string[] = Array.isArray(body.confirmedUpdateIds) ? body.confirmedUpdateIds : [];
    const confirmedRemoveIds: string[] = Array.isArray(body.confirmedRemoveIds) ? body.confirmedRemoveIds : [];

    let updatedCount = 0;

    if (confirmedAddIds.length > 0) {
      await db
        .update(mypWatchlist)
        .set({
          status: "watching",
          updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(
          and(
            eq(mypWatchlist.userId, userId),
            inArray(mypWatchlist.id, confirmedAddIds)
          )
        );
      updatedCount += confirmedAddIds.length;
    }

    if (confirmedUpdateIds.length > 0) {
      await db
        .update(mypWatchlist)
        .set({
          status: "watching",
          updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(
          and(
            eq(mypWatchlist.userId, userId),
            inArray(mypWatchlist.id, confirmedUpdateIds)
          )
        );
      updatedCount += confirmedUpdateIds.length;
    }

    if (confirmedRemoveIds.length > 0) {
      await db
        .delete(mypWatchlist)
        .where(
          and(
            eq(mypWatchlist.userId, userId),
            inArray(mypWatchlist.id, confirmedRemoveIds)
          )
        );
      updatedCount += confirmedRemoveIds.length;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

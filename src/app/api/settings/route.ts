import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;
    const lowPopThreshold = body.lowPopThreshold !== undefined ? parseInt(body.lowPopThreshold, 10) : undefined;
    const name = body.name?.trim();

    const updateData: any = {};
    if (lowPopThreshold !== undefined && !isNaN(lowPopThreshold)) {
      updateData.lowPopThreshold = lowPopThreshold;
    }
    if (name) {
      updateData.name = name;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, userId));
    }

    const updatedUser = await db.select().from(users).where(eq(users.id, userId)).get();
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

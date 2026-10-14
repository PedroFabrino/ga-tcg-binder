import { NextRequest, NextResponse } from "next/server";
import { calculateDeckShortage } from "@/services/shortage";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDefaultUserAndSeed();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || DEFAULT_USER_ID;

    const report = await calculateDeckShortage(params.id, userId, db);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

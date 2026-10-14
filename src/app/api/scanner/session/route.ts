import { NextRequest, NextResponse } from "next/server";
import { createScannerSession } from "@/services/scanner";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || DEFAULT_USER_ID;

    // Determine host base URL
    const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
    const session = await createScannerSession(userId, origin, db);

    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

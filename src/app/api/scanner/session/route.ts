import { NextRequest, NextResponse } from "next/server";
import { createScannerSession } from "@/services/scanner";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { FEATURES } from "@/lib/features";

export async function POST(req: NextRequest) {
  if (!FEATURES.scanner) {
    return NextResponse.json({ error: "Scanner feature is disabled" }, { status: 404 });
  }
  try {
    await ensureDefaultUserAndSeed();
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || DEFAULT_USER_ID;

    // Determine host base URL
    const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3002";
    const session = await createScannerSession(userId, origin, db);

    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { compareMetaDeckAgainstCollection } from "@/services/meta";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;
    const metaIdOrText = body.deckText || body.metaId;

    if (!metaIdOrText) {
      return NextResponse.json({ error: "deckText or metaId is required" }, { status: 400 });
    }

    const report = await compareMetaDeckAgainstCollection(metaIdOrText, userId, db);
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

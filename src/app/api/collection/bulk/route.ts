import { NextRequest, NextResponse } from "next/server";
import { importBulkCollectionText } from "@/services/collection";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;
    const text = body.text;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Card text is required" }, { status: 400 });
    }

    const result = await importBulkCollectionText(userId, text);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

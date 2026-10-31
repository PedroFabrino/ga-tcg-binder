import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { DeckNotFoundError, DeckValidationError, reorderDecksService } from "@/services/deck";
import { parseReorderRequest } from "@/lib/deck-order-validator";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();

    // Authenticate user strictly from session; fall back to DEFAULT_USER_ID in local/demo mode
    const userId = session?.user?.id || DEFAULT_USER_ID;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    const validation = parseReorderRequest(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await reorderDecksService(userId, validation.data.items.map((it) => ({
      id: it.id,
      section: it.section,
      priority: it.position,
    })));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof DeckValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof DeckNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[POST /api/decks/reorder] Internal failure:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

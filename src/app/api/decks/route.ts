import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed, migrateDefaultUserDataToUser } from "@/services/seed";
import { DeckValidationError, getUserDecksSummary, createDeckService } from "@/services/deck";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

    if (userId !== DEFAULT_USER_ID) {
      await migrateDefaultUserDataToUser(userId);
    }

    const decks = await getUserDecksSummary(userId);
    return NextResponse.json({ decks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();
    const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;

    const result = await createDeckService(userId, {
      name: body.name,
      champion: body.champion,
      format: body.format,
      omnidexText: body.omnidexText,
    });

    return NextResponse.json({ id: result.id, success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = error instanceof DeckValidationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

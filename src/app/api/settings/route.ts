import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { getUserSettings, updateUserSettingsService } from "@/services/settings";
import { parseSettingsInput } from "@/lib/validation/watchlist-schemas";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const urlUserId = req?.nextUrl?.searchParams?.get("userId");
    const userId = urlUserId || session?.user?.id || DEFAULT_USER_ID;

    const user = await getUserSettings(userId);
    return NextResponse.json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const userId = session?.user?.id || DEFAULT_USER_ID;

    const body = await req.json();
    const validation = parseSettingsInput(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const watchlistPolicy = typeof body.watchlistPolicy === "string" ? body.watchlistPolicy : undefined;

    const user = await updateUserSettingsService(userId, {
      ...validation.data,
      name,
      watchlistPolicy,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

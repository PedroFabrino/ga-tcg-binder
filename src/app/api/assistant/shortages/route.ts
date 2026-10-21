import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { getDeckShortages } from "@/services/collector-assistant";

export async function GET(request: Request) {
  if (!isAssistantAuthorized(request)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const providerUserId = searchParams.get("providerUserId");
  const deck = searchParams.get("deck");

  if (!deck || deck.trim().length === 0) {
    return NextResponse.json(
      { error: "MISSING_DECK", message: "Query parameter 'deck' is required" },
      { status: 400 }
    );
  }

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  const { collectorId } = resolution.context!;

  try {
    const shortages = await getDeckShortages(collectorId, deck);
    return NextResponse.json(shortages);
  } catch (err: any) {
    if (err?.message?.includes("Deck not found")) {
      return NextResponse.json(
        { error: "DECK_NOT_FOUND", message: err.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message || "Failed to calculate deck shortages" },
      { status: 500 }
    );
  }
}

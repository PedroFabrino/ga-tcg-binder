import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { getCollectorDecks } from "@/services/collector-assistant";

export async function GET(request: Request) {
  if (!(await isAssistantAuthorized(request))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const providerUserId = searchParams.get("providerUserId");

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  const { collectorId, collectorName } = resolution.context!;
  const decks = await getCollectorDecks(collectorId);

  return NextResponse.json({
    collectorId,
    collectorName,
    decks,
  });
}

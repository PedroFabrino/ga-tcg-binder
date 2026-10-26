import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { getAutocompleteChoices } from "@/services/assistant-wants-service";

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
  const typeParam = searchParams.get("type");
  const query = searchParams.get("query") || "";

  if (typeParam !== "card" && typeParam !== "wants" && typeParam !== "deck") {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "Parameter 'type' must be card, wants, or deck" },
      { status: 400 }
    );
  }

  let collectorId: string | null = null;
  if (provider && providerUserId) {
    const resolution = await resolveAssistantCaller(provider, providerUserId);
    if (resolution.context) {
      collectorId = resolution.context.collectorId;
    }
  }

  try {
    const choices = await getAutocompleteChoices(collectorId, typeParam, query);
    return NextResponse.json({ results: choices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Autocomplete search failed";
    return NextResponse.json({ error: "AUTOCOMPLETE_FAILED", message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { getCollectorDecks } from "@/services/collector-assistant";
import { importAssistantDeckFromSource } from "@/services/assistant-wants-service";

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

export async function POST(request: Request) {
  if (!(await isAssistantAuthorized(request))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider : null;
  const providerUserId = typeof body.providerUserId === "string" ? body.providerUserId : null;
  const url = typeof body.url === "string" ? body.url : undefined;
  const text = typeof body.text === "string" ? body.text : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;
  const champion = typeof body.champion === "string" ? body.champion : undefined;
  const format = typeof body.format === "string" ? body.format : undefined;

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  try {
    const deck = await importAssistantDeckFromSource(resolution.context!.collectorId, {
      url,
      text,
      name,
      champion,
      format,
    });
    return NextResponse.json({ success: true, deck });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import deck";
    return NextResponse.json({ error: "IMPORT_FAILED", message }, { status: 400 });
  }
}

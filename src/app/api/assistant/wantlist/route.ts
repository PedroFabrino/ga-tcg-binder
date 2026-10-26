import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { getDeckPartitionedWantlist } from "@/services/collector-assistant";
import {
  addWantToAssistant,
  removeWantFromAssistant,
  getAssistantWants,
} from "@/services/assistant-wants-service";

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
  const deck = searchParams.get("deck") || undefined;
  const personalOnly = searchParams.get("personalOnly") === "true";

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  const { collectorId, collectorName } = resolution.context!;

  if (personalOnly) {
    const personalWants = await getAssistantWants(collectorId);
    return NextResponse.json({
      collectorId,
      collectorName,
      personalWants,
    });
  }

  const wantlist = await getDeckPartitionedWantlist(collectorId, deck);
  const personalWants = await getAssistantWants(collectorId);

  return NextResponse.json({
    ...wantlist,
    personalWants,
    collectorName,
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
  const card = typeof body.card === "string" ? body.card : undefined;
  const quantity = typeof body.quantity === "number" ? body.quantity : undefined;
  const foil = typeof body.foil === "boolean" ? body.foil : null;
  const omnidexUrl = typeof body.omnidexUrl === "string" ? body.omnidexUrl : undefined;
  const omnidexText = typeof body.omnidexText === "string" ? body.omnidexText : undefined;

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  try {
    const result = await addWantToAssistant(resolution.context!.collectorId, {
      cardInput: card,
      quantity,
      foil,
      omnidexUrl,
      omnidexText,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add want";
    return NextResponse.json({ error: "ADD_WANT_FAILED", message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAssistantAuthorized(request))) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = typeof body.provider === "string" ? body.provider : null;
  const providerUserId = typeof body.providerUserId === "string" ? body.providerUserId : null;
  const card = typeof body.card === "string" ? body.card : "";
  const quantity = typeof body.quantity === "number" ? body.quantity : undefined;

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  try {
    const result = await removeWantFromAssistant(resolution.context!.collectorId, {
      cardInput: card,
      quantity,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove want";
    return NextResponse.json({ error: "REMOVE_WANT_FAILED", message }, { status: 400 });
  }
}

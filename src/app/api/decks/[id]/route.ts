import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultUserAndSeed } from "@/services/seed";
import {
  getDeckDetailService,
  updateDeckService,
  deleteDeckService,
  DeckNotFoundError,
} from "@/services/deck";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureDefaultUserAndSeed();
    const detail = await getDeckDetailService(params.id);

    if (!detail) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await updateDeckService(params.id, body);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = error instanceof DeckNotFoundError ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteDeckService(params.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = error instanceof DeckNotFoundError ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

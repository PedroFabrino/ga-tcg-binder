import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runDeckAdvisorChat } from "@/services/deck-advisor";
import { isUserAdvisorAllowlisted } from "@/services/deck-advisor-context";
import type { DeckAdvisorChatRequest } from "@ga/contracts";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const allowed = Boolean(userId && isUserAdvisorAllowlisted({ id: userId, email: userEmail }));

  return NextResponse.json({
    enabled: true,
    allowed,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  if (!userId || !isUserAdvisorAllowlisted({ id: userId, email: userEmail })) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const deckId = params.id;
  if (!deckId) {
    return NextResponse.json({ error: "MISSING_DECK_ID" }, { status: 400 });
  }

  try {
    const body: DeckAdvisorChatRequest = await req.json();
    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const response = await runDeckAdvisorChat(userId, userEmail, deckId, body.messages);
    return NextResponse.json(response);
  } catch (e: any) {
    console.error("[DeckAdvisor API] Error running chat:", e);
    if (e.message?.startsWith("UNAUTHORIZED_ADVISOR_ACCESS")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (e.message?.startsWith("DECK_NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: e.message },
      { status: 500 }
    );
  }
}

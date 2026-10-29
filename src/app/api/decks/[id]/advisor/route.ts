import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runDeckAdvisorChat } from "@/services/deck-advisor";
import { isUserAdvisorAllowlisted } from "@/services/deck-advisor-context";
import type { DeckAdvisorChatRequest, DeckAdvisorMessage } from "@ga/contracts";

function parseAdvisorChatRequestBody(raw: unknown): DeckAdvisorChatRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.deckId !== "string" || !obj.deckId.trim()) return null;
  if (!Array.isArray(obj.messages) || obj.messages.length === 0) return null;

  const validRoles = new Set(["user", "assistant", "system"]);
  const validMessages: DeckAdvisorMessage[] = [];

  for (const m of obj.messages) {
    if (!m || typeof m !== "object") return null;
    const msg = m as Record<string, unknown>;
    if (typeof msg.role !== "string" || !validRoles.has(msg.role)) return null;
    if (typeof msg.content !== "string") return null;

    validMessages.push({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    });
  }

  const locale =
    obj.locale === "pt-BR" || obj.locale === "en" ? (obj.locale as "en" | "pt-BR") : undefined;

  return {
    deckId: obj.deckId.trim(),
    messages: validMessages,
    locale,
  };
}

export async function GET(
  _req: NextRequest,
  _ctx: { params: { id: string } }
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
    const rawBody: unknown = await req.json();
    const parsedBody = parseAdvisorChatRequestBody(rawBody);

    if (!parsedBody || parsedBody.deckId !== deckId) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const response = await runDeckAdvisorChat(
      userId,
      userEmail,
      deckId,
      parsedBody.messages,
      undefined,
      undefined,
      parsedBody.locale || "en"
    );
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[DeckAdvisor API] Error running chat:", message);

    if (message.startsWith("UNAUTHORIZED_ADVISOR_ACCESS")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (message.startsWith("DECK_NOT_FOUND")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}

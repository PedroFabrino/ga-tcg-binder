import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";
import { auth } from "@/auth";
import { reorderDecksService } from "@/services/deck";

interface ReorderItem {
  id: string;
  section: "competitive" | "4fun";
  priority: number;
}

function parseReorderPayload(body: any): { userId?: string; items: ReorderItem[] } | null {
  if (!body || typeof body !== "object") return null;
  if (!Array.isArray(body.items) || body.items.length === 0) return null;

  const items: ReorderItem[] = [];
  for (const it of body.items) {
    if (!it || typeof it !== "object") return null;
    if (typeof it.id !== "string" || !it.id) return null;
    if (it.section !== "competitive" && it.section !== "4fun") return null;
    if (typeof it.priority !== "number" || isNaN(it.priority)) return null;
    items.push({
      id: it.id,
      section: it.section,
      priority: Math.max(0, Math.floor(it.priority)),
    });
  }

  const userId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : undefined;
  return { userId, items };
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const body = await req.json();

    const parsed = parseReorderPayload(body);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid reorder payload" },
        { status: 400 }
      );
    }

    const userId = parsed.userId || session?.user?.id || DEFAULT_USER_ID;

    await reorderDecksService(userId, parsed.items);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

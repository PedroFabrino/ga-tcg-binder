import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { queueIdentifiedCard, updateQueuedCard } from "@/services/scanner-queue";

const fail = (e: any) => NextResponse.json({ error: e.message }, { status: 400 });

/** Add an identified card to the paired session queue. */
export async function POST(req: NextRequest) {
  try {
    const { token, editionId, foil = false, confidence } = await req.json();
    if (!token || !editionId || typeof confidence !== "number") {
      return NextResponse.json({ error: "token, editionId and confidence are required" }, { status: 400 });
    }
    const item = await queueIdentifiedCard(token, { editionId, foil: !!foil, confidence }, db);
    return NextResponse.json({ item });
  } catch (e) {
    return fail(e);
  }
}

/** Change variant of, or undo, a queued card by its timestamp key. */
export async function PATCH(req: NextRequest) {
  try {
    const { token, timestamp, foil, remove } = await req.json();
    if (!token || typeof timestamp !== "number") {
      return NextResponse.json({ error: "token and timestamp are required" }, { status: 400 });
    }
    await updateQueuedCard(token, timestamp, remove ? { remove: true } : { foil: !!foil }, db);
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}

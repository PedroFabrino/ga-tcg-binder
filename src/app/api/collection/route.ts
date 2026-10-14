import { NextRequest, NextResponse } from "next/server";
import {
  getCollectionSmartView,
  addOrUpdateCollectionItem,
  SmartViewType,
} from "@/services/collection";
import { db } from "@/db";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const url = new URL(req.url);
    const view = (url.searchParams.get("view") || "ALL").toUpperCase() as SmartViewType;
    const userId = url.searchParams.get("userId") || DEFAULT_USER_ID;

    const items = await getCollectionSmartView(userId, view, db);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const body = await req.json();
    const userId = body.userId || DEFAULT_USER_ID;
    const editionId = body.editionId;
    const foil = Boolean(body.foil);
    const quantity = parseInt(body.quantity, 10);
    const isDedicated = body.isDedicated !== undefined ? Boolean(body.isDedicated) : undefined;

    if (!editionId || isNaN(quantity)) {
      return NextResponse.json({ error: "editionId and quantity are required" }, { status: 400 });
    }

    await addOrUpdateCollectionItem(
      {
        userId,
        editionId,
        foil,
        quantity,
        isDedicated,
      },
      db
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

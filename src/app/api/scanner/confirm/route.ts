import { NextRequest, NextResponse } from "next/server";
import { confirmScannedCardsToCollection } from "@/services/scanner";
import { db } from "@/db";
import { FEATURES } from "@/lib/features";

export async function POST(req: NextRequest) {
  if (!FEATURES.scanner) {
    return NextResponse.json({ error: "Scanner feature is disabled" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const token = body.token;
    const indices = body.indices;

    if (!token || !Array.isArray(indices)) {
      return NextResponse.json({ error: "token and indices array are required" }, { status: 400 });
    }

    const confirmed = await confirmScannedCardsToCollection(token, indices, db);
    return NextResponse.json({ success: true, confirmedCount: confirmed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

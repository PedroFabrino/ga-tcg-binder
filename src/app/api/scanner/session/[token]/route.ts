import { NextRequest, NextResponse } from "next/server";
import { getScannerSession } from "@/services/scanner";
import { db } from "@/db";
import { FEATURES } from "@/lib/features";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  if (!FEATURES.scanner) {
    return NextResponse.json({ error: "Scanner feature is disabled" }, { status: 404 });
  }
  try {
    const session = await getScannerSession(params.token, db);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

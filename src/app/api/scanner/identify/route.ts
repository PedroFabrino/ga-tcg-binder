import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getScannerSession } from "@/services/scanner";
import { identifyCard } from "@/services/scanner-match";
import { FEATURES } from "@/lib/features";

/** Stage 5 endpoint. Authorised by the paired scanner token (no login on the phone). */
export async function POST(req: NextRequest) {
  if (!FEATURES.scanner) {
    return NextResponse.json({ error: "Scanner feature is disabled" }, { status: 404 });
  }
  try {
    const { token, phash, headerText = "", footerText = "" } = await req.json();
    if (!token || typeof phash !== "string" || !/^[0-9a-f]{16}$/.test(phash)) {
      return NextResponse.json({ error: "token and a 16-char hex phash are required" }, { status: 400 });
    }
    const session = await getScannerSession(token, db);
    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Scanner session is invalid or expired" }, { status: 401 });
    }
    const candidates = await identifyCard({ phash, headerText: String(headerText), footerText: String(footerText) }, db);
    return NextResponse.json({ candidates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

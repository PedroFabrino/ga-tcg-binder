import { NextRequest, NextResponse } from "next/server";
import { submitScannerDetections } from "@/services/scanner";
import { db } from "@/db";
import { FEATURES } from "@/lib/features";

export async function POST(req: NextRequest) {
  if (!FEATURES.scanner) {
    return NextResponse.json({ error: "Scanner feature is disabled" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const token = body.token;
    const detections = body.detections;

    if (!token || !Array.isArray(detections)) {
      return NextResponse.json({ error: "token and detections array are required" }, { status: 400 });
    }

    const recorded = await submitScannerDetections(token, detections, db);
    return NextResponse.json({ success: true, count: recorded.length, items: recorded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

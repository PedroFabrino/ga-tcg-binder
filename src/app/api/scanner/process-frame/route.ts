import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getScannerSession } from "@/services/scanner";
import { processCardFrame } from "@/services/frame-processor";

export const maxDuration = 30; // Max allowed duration on Vercel/Node

export async function POST(req: NextRequest) {
  try {
    const { token, imageBase64 } = await req.json();

    if (!token || !imageBase64) {
      return NextResponse.json({ error: "token and imageBase64 are required" }, { status: 400 });
    }

    const session = await getScannerSession(token, db);
    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Scanner session is invalid or expired" }, { status: 401 });
    }

    // Clean base64 header if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");

    const result = await processCardFrame(imageBuffer, db);

    return NextResponse.json({
      candidates: result.candidates,
      phash: result.phash,
      headerText: result.headerText,
      footerText: result.footerText,
      glareRatio: result.glareRatio,
    });
  } catch (error: any) {
    console.error("[api/scanner/process-frame] Error:", error);
    return NextResponse.json({ error: error.message || "Frame processing failed" }, { status: 500 });
  }
}

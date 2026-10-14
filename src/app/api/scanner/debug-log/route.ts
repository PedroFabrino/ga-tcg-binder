import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { level = "info", stage = "unknown", message = "", details = {}, userAgent } = body;
    const ua = userAgent || req.headers.get("user-agent") || "unknown";

    const logPrefix = `[SCANNER_DEBUG] [${level.toUpperCase()}] [${stage}]`;
    const payload = {
      message,
      details,
      ua,
      time: new Date().toISOString(),
    };

    if (level === "error") {
      console.error(logPrefix, JSON.stringify(payload, null, 2));
    } else if (level === "warn") {
      console.warn(logPrefix, JSON.stringify(payload, null, 2));
    } else {
      console.log(logPrefix, JSON.stringify(payload, null, 2));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[SCANNER_DEBUG_FAILED_TO_LOG]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

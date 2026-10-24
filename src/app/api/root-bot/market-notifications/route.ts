import { NextResponse } from "next/server";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { listPendingMarketChunks } from "@/services/root-bot-service";

export async function GET(request: Request) {
  const caller = await authenticateRootBot(request);
  if (!caller) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid Root bot install token" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    chunks: await listPendingMarketChunks(caller.communityId),
  });
}

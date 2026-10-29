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

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = localeParam === "pt-BR" ? "pt-BR" : "en";

  return NextResponse.json({
    chunks: await listPendingMarketChunks(caller.communityId, locale),
  });
}

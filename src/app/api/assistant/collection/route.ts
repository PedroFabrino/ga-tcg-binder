import { NextResponse } from "next/server";
import { isAssistantAuthorized, resolveAssistantCaller } from "@/services/assistant-auth";
import { searchCollectorCollection } from "@/services/collector-assistant";
import { getCollectorPortfolioSummary } from "@/services/collector-portfolio";

export async function GET(request: Request) {
  if (!isAssistantAuthorized(request)) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid assistant authentication token" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const providerUserId = searchParams.get("providerUserId");
  const query = searchParams.get("query");

  const resolution = await resolveAssistantCaller(provider, providerUserId);
  if (resolution.error) {
    return NextResponse.json(
      { error: resolution.error.code, message: resolution.error.message },
      { status: resolution.error.status }
    );
  }

  const { collectorId } = resolution.context!;

  if (!query) {
    const portfolio = await getCollectorPortfolioSummary(collectorId);
    return NextResponse.json({
      collectorId,
      portfolio,
    });
  }

  const result = await searchCollectorCollection(collectorId, query);

  return NextResponse.json(result);
}

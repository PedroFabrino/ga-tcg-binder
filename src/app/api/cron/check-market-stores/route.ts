import { auth } from "@/auth";
import { checkMarketStores } from "@/services/market-check";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${cronSecret}`;
}

async function hasAdminSession(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}

export async function GET(request: Request): Promise<NextResponse> {
  const authorizedBySecret = hasValidCronSecret(request);
  const authorizedBySession = authorizedBySecret
    ? false
    : await hasAdminSession();

  if (!authorizedBySecret && !authorizedBySession) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const report = await checkMarketStores();

  return NextResponse.json(report, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

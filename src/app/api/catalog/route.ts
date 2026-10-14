import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/services/catalog";
import { db } from "@/db";
import { ensureDefaultUserAndSeed, DEFAULT_USER_ID } from "@/services/seed";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const session = await auth();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;
    const query = url.searchParams.get("query") || undefined;
    const element = url.searchParams.get("element") || undefined;
    const cardClass = url.searchParams.get("class") || undefined;
    const cardType = url.searchParams.get("type") || undefined;
    const setPrefix = url.searchParams.get("setPrefix") || undefined;
    const lowPopOnly = url.searchParams.get("lowPopOnly") === "true";
    const lowPopThreshold = url.searchParams.get("threshold")
      ? parseInt(url.searchParams.get("threshold")!, 10)
      : 1000;
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!, 10)
      : 40;
    const offset = url.searchParams.get("offset")
      ? parseInt(url.searchParams.get("offset")!, 10)
      : 0;

    const result = await searchCatalog(
      {
        query,
        element,
        class: cardClass,
        type: cardType,
        setPrefix,
        lowPopOnly,
        lowPopThreshold,
        userId,
        limit,
        offset,
      },
      db
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

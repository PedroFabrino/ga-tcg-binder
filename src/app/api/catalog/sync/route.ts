import { NextRequest, NextResponse } from "next/server";
import { syncCatalogFromApi } from "@/services/catalog-sync";
import { db } from "@/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const maxPages = body.maxPages ? parseInt(body.maxPages, 10) : undefined;

    const stats = await syncCatalogFromApi({
      targetDb: db,
      maxPages,
    });

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

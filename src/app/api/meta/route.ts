import { NextRequest, NextResponse } from "next/server";
import { getMetaArchetypes, seedMetaArchetypes } from "@/services/meta";
import { db } from "@/db";
import { ensureDefaultUserAndSeed } from "@/services/seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const archetypes = await getMetaArchetypes(db);
    return NextResponse.json({ archetypes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

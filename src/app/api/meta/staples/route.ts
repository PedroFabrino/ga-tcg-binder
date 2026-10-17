import { NextRequest, NextResponse } from "next/server";
import { syncMetaStaples, getMetaStaples } from "@/services/meta-staples";
import { db } from "@/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const staples = await getMetaStaples(db);
    return NextResponse.json({ staples });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized =
      Boolean(session?.user) ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncMetaStaples(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

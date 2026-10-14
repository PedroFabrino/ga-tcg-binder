import { NextRequest, NextResponse } from "next/server";
import { getCollectionSmartView } from "@/services/collection";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { friendId: string } }
) {
  try {
    const friend = await db.select().from(users).where(eq(users.id, params.friendId)).get();
    if (!friend) {
      return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    const idleItems = await getCollectionSmartView(params.friendId, "IDLE", db);

    return NextResponse.json({
      friend: {
        id: friend.id,
        name: friend.name,
        friendCode: friend.friendCode,
      },
      idleCards: idleItems,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

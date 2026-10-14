import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, friendLinks } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || DEFAULT_USER_ID;

    // Fetch user details for self code
    const selfUser = await db.select().from(users).where(eq(users.id, userId)).get();

    // Fetch accepted friend links
    const links = await db
      .select()
      .from(friendLinks)
      .where(
        and(
          or(eq(friendLinks.userId1, userId), eq(friendLinks.userId2, userId)),
          eq(friendLinks.status, "accepted")
        )
      );

    const friendIds = links.map((l) => (l.userId1 === userId ? l.userId2 : l.userId1));

    let friendsList: any[] = [];
    if (friendIds.length > 0) {
      for (const fId of friendIds) {
        const u = await db.select().from(users).where(eq(users.id, fId)).get();
        if (u) {
          friendsList.push({
            id: u.id,
            name: u.name,
            friendCode: u.friendCode,
            createdAt: u.createdAt,
          });
        }
      }
    }

    return NextResponse.json({
      currentUser: selfUser,
      friends: friendsList,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultUserAndSeed();
    const body = await req.json();
    const userId = body.userId || DEFAULT_USER_ID;
    const friendCode = body.friendCode?.trim();

    if (!friendCode) {
      return NextResponse.json({ error: "friendCode is required" }, { status: 400 });
    }

    const targetUser = await db
      .select()
      .from(users)
      .where(sql`upper(${users.friendCode}) = upper(${friendCode})`)
      .get();

    if (!targetUser) {
      return NextResponse.json({ error: "No collector found with that friend code" }, { status: 404 });
    }

    if (targetUser.id === userId) {
      return NextResponse.json({ error: "You cannot add yourself as a friend" }, { status: 400 });
    }

    // Check if link already exists
    const existing = await db
      .select()
      .from(friendLinks)
      .where(
        or(
          and(eq(friendLinks.userId1, userId), eq(friendLinks.userId2, targetUser.id)),
          and(eq(friendLinks.userId1, targetUser.id), eq(friendLinks.userId2, userId))
        )
      )
      .get();

    if (existing) {
      return NextResponse.json({ message: "Already connected", friend: targetUser });
    }

    const linkId = `fl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.insert(friendLinks).values({
      id: linkId,
      userId1: userId,
      userId2: targetUser.id,
      status: "accepted",
    });

    return NextResponse.json({ success: true, friend: targetUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

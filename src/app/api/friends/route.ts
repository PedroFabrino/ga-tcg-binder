  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/auth";
  import {
  addFriendByCodeService,
  FriendNotFoundError,
  FriendValidationError,
  getFriendsListService,
} from "@/services/friend";
  import { DEFAULT_USER_ID, ensureDefaultUserAndSeed } from "@/services/seed";

  export async function GET(req: NextRequest) {
    try {
      await ensureDefaultUserAndSeed();
      const session = await auth();
      const userId = new URL(req.url).searchParams.get("userId") || session?.user?.id || DEFAULT_USER_ID;

      return NextResponse.json(await getFriendsListService(userId));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  export async function POST(req: NextRequest) {
    try {
      await ensureDefaultUserAndSeed();
      const session = await auth();
      const body = await req.json();
      const userId = body.userId || session?.user?.id || DEFAULT_USER_ID;
      const friendCode = body.friendCode?.trim();

      if (!friendCode) {
        return NextResponse.json({ error: "friendCode is required" }, { status: 400 });
      }

      return NextResponse.json(await addFriendByCodeService(userId, friendCode));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = error instanceof FriendNotFoundError
        ? 404
        : error instanceof FriendValidationError
          ? 400
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }
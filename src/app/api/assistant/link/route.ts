import { NextRequest, NextResponse } from "next/server";
import { linkIdentityWithToken } from "@/services/collector-assistant";
import { authenticateRootBot } from "@/services/root-bot-auth";
import { noteRootCommunityMember } from "@/services/root-bot-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, provider, providerUserId, providerUsername } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (provider !== "discord" && provider !== "root") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    if (!providerUserId || typeof providerUserId !== "string") {
      return NextResponse.json({ error: "Missing providerUserId" }, { status: 400 });
    }

    if (provider === "root") {
      const caller = await authenticateRootBot(req);
      if (caller) {
        await noteRootCommunityMember(caller.communityId, providerUserId);
      }
    }

    const result = await linkIdentityWithToken({
      token,
      provider,
      providerUserId,
      providerUsername: providerUsername || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to link identity" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      collector: result.collector,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

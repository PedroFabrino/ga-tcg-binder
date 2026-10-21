import { NextResponse } from "next/server";
import {
  verifyDiscordSignature,
  handleDiscordInteraction,
  type DiscordInteractionPayload,
} from "@/services/discord-interaction";

export async function POST(request: Request) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (publicKey) {
    if (!signature || !timestamp) {
      return new NextResponse("Missing signature headers", { status: 401 });
    }

    const isValid = verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
    if (!isValid) {
      return new NextResponse("Invalid request signature", { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody) as DiscordInteractionPayload;
    const response = await handleDiscordInteraction(payload);
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: err?.message || "Invalid payload" },
      { status: 400 }
    );
  }
}

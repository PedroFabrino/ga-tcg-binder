import crypto from "crypto";
import {
  type DiscordInteractionPayload,
  type DiscordInteractionResponse,
  type DiscordEmbed,
  type DiscordEmbedField,
  type DiscordInteractionDataOption,
} from "./discord-interactions/types";
import { handleDiscordApplicationCommand } from "./discord-interactions/commands";
import { handleDiscordMessageComponent } from "./discord-interactions/components";
import { handleDiscordAutocomplete } from "./discord-interactions/autocomplete";
import { handleDiscordModalSubmit } from "./discord-interactions/modals";

export type {
  DiscordInteractionPayload,
  DiscordInteractionResponse,
  DiscordEmbed,
  DiscordEmbedField,
  DiscordInteractionDataOption,
};

/**
 * Validates Ed25519 signature headers sent by Discord.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string,
  timestamp: string,
  clientPublicKeyHex: string
): boolean {
  try {
    const prefix = Buffer.from("302a300506032b6570032100", "hex");
    const rawPub = Buffer.from(clientPublicKeyHex, "hex");
    const key = crypto.createPublicKey({
      key: Buffer.concat([prefix, rawPub]),
      format: "der",
      type: "spki",
    });
    const message = Buffer.from(timestamp + rawBody);
    const signature = Buffer.from(signatureHex, "hex");
    return crypto.verify(null, message, key, signature);
  } catch {
    return false;
  }
}

/**
 * Main dispatcher routing inbound Discord interaction payloads to their handler.
 * - type 1: PING -> PONG
 * - type 2: APPLICATION_COMMAND -> handleDiscordApplicationCommand
 * - type 3: MESSAGE_COMPONENT -> handleDiscordMessageComponent
 * - type 4: APPLICATION_COMMAND_AUTOCOMPLETE -> handleDiscordAutocomplete
 * - type 5: MODAL_SUBMIT -> handleDiscordModalSubmit
 */
export async function handleDiscordInteraction(
  payload: DiscordInteractionPayload,
  database?: unknown
): Promise<DiscordInteractionResponse> {
  // 1. PING
  if (payload.type === 1) {
    return { type: 1 };
  }

  // 2. APPLICATION_COMMAND (Slash Commands)
  if (payload.type === 2) {
    return handleDiscordApplicationCommand(payload, database);
  }

  // 3. MESSAGE_COMPONENT (Select Menus / Buttons)
  if (payload.type === 3) {
    return handleDiscordMessageComponent(payload, database);
  }

  // 4. APPLICATION_COMMAND_AUTOCOMPLETE
  if (payload.type === 4) {
    return handleDiscordAutocomplete(payload, database);
  }

  // 5. MODAL_SUBMIT
  if (payload.type === 5) {
    return handleDiscordModalSubmit(payload, database);
  }

  return {
    type: 4,
    data: {
      flags: 64,
      embeds: [
        {
          title: "Unsupported Interaction Type",
          description: `Interaction type \`${payload.type}\` is not supported.`,
          color: 0xe74c3c,
        },
      ],
    },
  };
}

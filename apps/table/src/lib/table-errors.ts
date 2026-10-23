import type { TranslationKey } from "@ga/contracts";

/** Handshake errors that a blind reconnect cannot fix. */
export const HANDSHAKE_ERROR_CODES = new Set([
  "DISPLACED",
  "INVALID_TOKEN",
  "WRONG_CODE",
  "NO_SUCH_TABLE",
]);

const ERROR_KEYS: Record<string, TranslationKey> = {
  INVALID_TOKEN: "table.errors.invalidToken",
  WRONG_CODE: "table.errors.wrongCode",
  NO_SUCH_TABLE: "table.errors.noSuchTable",
  DISPLACED: "table.errors.displaced",
  FORBIDDEN: "table.errors.forbidden",
  NOT_YOUR_TURN: "table.errors.notYourTurn",
  BAD_REQUEST: "table.errors.badRequest",
  INVALID_MESSAGE: "table.errors.invalidMessage",
  NO_TARGET: "table.errors.noTarget",
};

export function tableErrorKey(code: string): TranslationKey {
  return ERROR_KEYS[code] ?? "table.errors.generic";
}

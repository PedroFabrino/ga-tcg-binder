import type { SeatId } from "@ga/contracts";

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Normalize a hand-typed room code, or null when it cannot be one. */
export function parseTableCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** The app path that carries one Seat's token. */
export function tableSeatPath(code: string, seat: SeatId, token: string): string {
  const normalized = code.trim().toUpperCase();
  const query = new URLSearchParams({ seat, token });
  return `/t/${encodeURIComponent(normalized)}?${query.toString()}`;
}

/** The absolute p2 invite link shown to the host. */
export function tableInviteUrl(origin: string, code: string, p2Token: string): string {
  return new URL(tableSeatPath(code, "p2", p2Token), origin).toString();
}

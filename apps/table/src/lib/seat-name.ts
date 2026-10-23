import type { SeatId, TableState } from "@ga/contracts";

/** A Seat's display name, falling back to the translated seat label. */
export function seatDisplayName(
  seats: TableState["seats"],
  seat: SeatId,
  fallback: string
): string {
  return seats[seat]?.displayName.trim() || fallback;
}

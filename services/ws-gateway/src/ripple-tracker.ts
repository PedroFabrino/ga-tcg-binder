import { RIPPLE_TTL_MS, type Ripple, type SeatId } from "@ga/contracts";

/**
 * Ephemeral pointer markers: assigns stable marker numbers, drops expired
 * markers, and schedules one cleanup broadcast. Keeping this out of TableRoom
 * leaves the room focused on seats, Turns, Pins, and signaling.
 */
export class RippleTracker {
  private sequence = 0;

  constructor(private readonly onExpire: () => void) {}

  add(seat: SeatId, x: number, y: number, now: number = Date.now()): Ripple {
    this.sequence += 1;
    return { seat, x, y, n: this.sequence, at: now };
  }

  prune(ripples: readonly Ripple[], now: number = Date.now()): Ripple[] {
    return ripples.filter((ripple) => now - ripple.at < RIPPLE_TTL_MS);
  }

  schedule(): void {
    const timer = setTimeout(this.onExpire, RIPPLE_TTL_MS + 25);
    (timer as { unref?: () => void }).unref?.();
  }
}

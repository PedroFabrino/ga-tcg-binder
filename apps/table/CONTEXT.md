# GrandTable Tabletop

Two players play a physical game of Grand Archive over video, sharing board state that both can see and neither can secretly edit.

Card, Printing, Deck, and Canonical Decklist keep the meanings defined in `ga-tcg-binder/CONTEXT.md`; they are not redefined here.

## Language

**Table**:
A live session in which exactly two Seats share video and mirrored board state.
_Avoid_: Room, match, game, lobby

**Room Code**:
The short token that addresses a Table for joining, and the link that carries it.
_Avoid_: Room ID, invite code, PIN

**Seat**:
One player's position at a Table. A Seat owns a HUD and may publish one or more Feeds.
_Avoid_: Player, side, peer, participant

**Feed**:
One video source from one device showing one Seat's physical board. A device provides at most one Feed.
_Avoid_: Camera, stream, track, peer

**Capture Device**:
The device that produces a Seat's Feed: the desktop webcam or the paired phone.
_Avoid_: Camera, transmitter, scanner

**Pin**:
A Card a Seat has deliberately shown to the whole Table.
_Avoid_: Spotlight, inspection, match, recognition, scan

**HUD**:
The mirrored, manually operated counters belonging to a Seat.
_Avoid_: State, scoreboard, tracker, overlay

**Whiteboard**:
The model in which the app mirrors the physical game and holds no hidden information.
_Avoid_: Referee, arbiter, judge, engine, simulator

**Overlay**:
A read-only, transparent rendering of Table state for broadcast, carrying no controls.
_Avoid_: OBS view, stream, HUD

**Turn**:
The period during which one Seat is active. Tracked only as a single active Seat, never broken into phases.
_Avoid_: Phase, step, priority

**Champion**:
The Card in a player's champion zone. Its printed level is that player's level and its printed life is that player's life total.
_Avoid_: Commander, leader, avatar

**Memory cost**:
A cost paid by banishing randomly selected cards from a player's Memory zone.
_Avoid_: Random banish, memory payment, resource cost

**Reserve cost**:
A cost paid by placing chosen cards from a player's hand face-down into Memory.
_Avoid_: Memory cost, resource cost

**Recollection**:
The phase in which a player returns every card in their Memory zone to their hand.
_Avoid_: Cleanup, reset, refresh

**Influence**:
The total number of cards in a player's hand and Memory zones, derived from those counts rather than tracked on its own.
_Avoid_: Resource, mana, energy

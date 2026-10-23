# The Whiteboard model: mirror the table, never hold hidden information

GrandTable displays and mirrors the physical game; it does not arbitrate it. Every value is a manually operated counter visible to both Seats, attributed in an action log, and the application never stores hand contents, Memory contents, or deck order. The reason is that a physical game is already being played, so any claim the app makes about hidden state is either unverifiable or an anti-cheat mechanism nobody asked for — and the moment it holds hidden state it needs accounts, server-side filtering, and a rules engine to stay honest.

**Considered options:** Referee (private per-player zones, eventually rules enforcement and anti-cheat — rejected for v1 as it makes the app a service and the code a judge); hybrid notes (rejected as unnecessary).

**Consequences:** decklists stay in the owning browser and are never broadcast — which is why per-Seat recognised cards fall back to a global catalog, and why a future recognition service must match server-side rather than ship lists to clients. The app also cannot settle a dispute: the action log is evidence, not a verdict. Counters are deliberately dumb, and a wrong counter is the players' problem, exactly as a knocked-over die is.

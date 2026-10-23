# GrandTable — local model lineup

**Hardware:** 8 GB VRAM, 32 GB RAM, Windows. **Tooling:** Ollama (with a llama.cpp escape hatch for one model).

## Strategy

- **DeepSeek V4 Pro (API)** is the authoritative model: it builds the four foundation tickets (scaffold, contracts, room state machine, WebRTC manager) and reviews/debugs everything. It is already the harness model, so no setup.
- **Two local builders**, split by task type: a fast 7B for mechanical tickets, a 30B MoE for complex ones.
- **One optional local reviewer** for cheap pre-review before the DeepSeek pass.

## The fact that governs everything on 8 GB

The KV cache, not the weights, is what kills an 8 GB box mid-session — context grows with every tool call, diff, and log, and once it spills the run crawls. Two consequences, both already reflected in the ticket plan: **tickets stay small and single-file**, and **MoE beats dense** on this hardware (a 30B-A3B keeps its experts in RAM and only 3.3B active parameters on the GPU; a dense 14B hauls every layer over the bus every step).

## Models to have ready

| `ollama pull` | Role | Footprint | Speed | Use for |
| --- | --- | --- | --- | --- |
| `qwen3-coder:7b` | Fast builder | ~4.7 GB Q4, fully on GPU | 30–50 tok/s | Mechanical tickets: reducer, HUD page, tokens, turn/log, parser, ripple |
| `qwen3-coder:30b` | Quality builder | ~19 GB Q4, MoE offloaded to CPU | ~5–10 tok/s (Ollama) | Complex tickets: pins grid, overlay, cam page, hardening |
| `qwen3:8b` | Local reviewer (thinking) | ~5.2 GB Q4, fully on GPU | 30–50 tok/s | Optional first-pass review / "explain this diff" before DeepSeek |

**Fallbacks** if a tag 404s at pull time: `qwen2.5-coder:7b`, `qwen2.5-coder:14b`.

**Escape hatch:** if `qwen3-coder:30b` feels slow under Ollama, run it through llama.cpp with `--n-cpu-moe`, which keeps the MoE experts in system RAM explicitly. A known-good config on an 8 GB card reports ~29 tok/s generation with a 256K-capable TurboQuant KV cache (RTX 3060 Ti, 8 GB, Windows). That is the one case where leaving Ollama is worth it.

## Context guidance

- Keep each run under ~12–16k tokens. The ticket body, the one file being edited, and the `@ga/contracts` types it references fit comfortably there.
- Prefer Q5/Q6 over Q4 for `qwen3-coder:7b` if a tag offers it — exact TypeScript syntax is where the extra bit-depth pays.
- A ticket is finished when its acceptance criteria pass, the architecture-guardrails and i18n-parity tests pass, and no new dependency lacks an ADR. DeepSeek reviews the diff, not the prose.

## Model per ticket

| Ticket | Model |
| --- | --- |
| F1 Scaffold `apps/table` | DeepSeek V4 Pro |
| F2 Table contracts (`@ga/contracts`) | DeepSeek V4 Pro |
| F3 `TableRoom` state machine | DeepSeek V4 Pro |
| F4 WebRTC manager | DeepSeek V4 Pro |
| 5 Client state reducer + test | `qwen3-coder:7b` |
| 6 Two-Seat HUD page | `qwen3-coder:7b` |
| 7 Seat join / token / takeover | `qwen3-coder:7b` |
| 8 Turn + action log UI | `qwen3-coder:7b` |
| 9 `/cam` page + QR + camera states | `qwen3-coder:30b` |
| 10 Deck import parser + champion fix | `qwen3-coder:7b` |
| 11 Deck grid + Pins + three-Pin log | `qwen3-coder:30b` |
| 12 Pointer ripple | `qwen3-coder:7b` |
| 13 Overlay + `/stage` | `qwen3-coder:30b` |
| 14 Hardening + real-network check | `qwen3-coder:30b` |

Review of every ticket: **DeepSeek V4 Pro** (or V4.1 Flash for a faster pass on the mechanical 7B tickets).

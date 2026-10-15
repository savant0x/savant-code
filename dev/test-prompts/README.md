# Test Prompts

This directory contains reusable validation prompts and live harnesses.

- Root-level files are active prompts or current harnesses.
- **Deep-research prompts** (`*-deep-research-prompt.md`) are paste-ready
  payloads for a deep-research engine (method: attach the prompt + Savant-Code
  core files + the referenced repo for context). Moved here from the idea
  shelf on 2026-09-28; they are prompts to run, not shelved ideas.
- **Run status (2026-09-28 review):** `auto-drive` and `devvy-integration`
  are **REALIZED** — their features shipped before the prompts were ever fed
  to a research engine (Auto Drive: FID-2026-0818-001..008 + `/auto-drive`;
  Discord Rich Presence: FID-2026-0818-009 + `/presence`, design doc at
  `docs/design/Discord Presence For Savant-Code.md`) — both now in
  [`archive/`](archive/). Still runnable, at root: `mcp-search-server`,
  `savant-desktop-chat`, `zero-cost-search` (note: `desktop/` shipped and
  desktop design docs exist — verify overlap before re-running the chat
  prompt).
- The current comprehensive A–Z harness prompt is
  [`az-v0.0.35-harness-live-test.md`](az-v0.0.35-harness-live-test.md). It
  covers the full 0.0.35 delta — the OpenAI platform provider
  (FID-2026-1001-001), the connector layer (FID-2026-0930-001/-002/-003),
  gut-the-backend stages 1–2 (FID-2026-0929-004/-005), and the 09-29
  hardening batch (FID-2026-0929-001/-002/-003) — with the full static +
  executable gate matrix, a deterministic trigger path per feature row, and
  the mandatory **Agent View** report section (§7) for out-of-band findings.
  It writes its report to
  `dev/scratchpad/az-v0.0.35-harness-live-test-report.md`. The older
  per-release harnesses remain runnable for regression archaeology
  (`az-v0.0.24-…`, `az-v0.0.25-…`, `az-v0.0.26-…`).
- The Agent-Steering Teacher A–Z prompt is
  [`az-teacher-live-test.md`](az-teacher-live-test.md). It covers the `/learn`
  lifecycle (Forge → sandbox → graders → critique), the read-only `Teacher`
  sidebar panel, per-attempt ZTAP receipts, versioned progression, and the
  zero-authority/private-pack boundary, and writes its report to
  `dev/scratchpad/az-teacher-live-test-report.md`. The live Forge requires an
  authenticated Savant Code client; an unauthenticated session must honestly
  record the fail-closed `unavailable` surface rather than a fabricated pass.
  Its headless driver is [`az-teacher-driver.ts`](az-teacher-driver.ts)
  (`bun dev/test-prompts/az-teacher-driver.ts`) — it drives the full lifecycle
  with a stub Forge + in-memory store so every logic row has a deterministic
  trigger path and never degrades to `NEEDS-REVIEW`.
- The Auto Drive + Discord Rich Presence live test is
  [`az-auto-drive-discord-live-test.md`](az-auto-drive-discord-live-test.md).
  It covers the Auto Drive program (`FID-2026-0818-001` master + children
  `002`–`008`) and the Discord Rich Presence subsystem (`009`), with a
  deterministic trigger path per row (static + executable gates re-run, plus
  the operator-owned live surfaces: TUI `/auto-drive`, headless `--auto`,
  crash-resume, and the live Discord client — the Discord application + assets
  already configured by the operator, so no app setup is required). It writes its report to
  `dev/scratchpad/az-auto-drive-discord-live-test-report.md`.
- The design-system live test is
  [`design-system-live-ux-performance.md`](design-system-live-ux-performance.md).
  It validates loadable design-system usability, agent feedback, cold/warm
  latency, resource/context overhead, persistence, headless errors, and
  enforcement correction.
- [`archive/`](archive/) contains historical prompts and result records,
  including the superseded v0.0.21 build/release-system prompt and the
  v0.0.23 comprehensive + harness prompts.
- Generated result dumps should live with the relevant archived benchmark
  material, not beside active prompts.

Keep prompt files deterministic and document the command used to run executable
harnesses near their header.

# Test Prompts

This directory contains reusable validation prompts and live harnesses.

- Root-level files are active prompts or current harnesses.
- The current comprehensive A–Z harness prompt is
  [`az-v0.0.24-harness-live-test.md`](az-v0.0.24-harness-live-test.md). It
  covers the full 0.0.24 delta — ZTAP provenance (FID-2026-0813-001..010), the
  Agent-Steering Teacher (`011..020` + live sidebar `022`), the canonical
  version-bump tool (`021`), the harness observability/integrity remediation
  (`023`), and the goal-engine/hook-system/model-unification/compaction
  remediation (`FID-2026-0814-002..007`) — with a deterministic trigger path
  per row and a mandatory **Agent View** report section (§7) for out-of-band
  findings. It writes its report to
  `dev/scratchpad/az-v0.0.24-harness-live-test-report.md`.
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

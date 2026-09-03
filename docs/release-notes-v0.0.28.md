<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Savant-Code v0.0.28 — Release Notes

> **Status: pending release.** This document is the v0.0.28 release body for the GitHub
> release and the npm publish announcement. Detailed per-FID records live in
> [CHANGELOG.md](../CHANGELOG.md).

**v0.0.28 is the integrity, evaluation, and desktop release.** Six days of work
(2026-08-21 → 09-02, 650 files, +80k lines) delivered two rebuilt core subsystems —
context-compaction integrity and the evaluation/benchmark harness — plus the desktop
app coming of age: a structured chat surface, an Auto Drive dashboard, and a 3D command
deck rebuilt as a neon-noir agent office where the 10-agent cast mirrors your coding
session in real time. **35 FIDs closed + archived**; the benchmark suite runs **9/9 PASS**.

## What's new

### Compaction integrity rebuild (FID-2026-0824-022 + children)

The auto-compaction pipeline was rebuilt end-to-end so that compaction is now
**inspectable, accountable, and honest** about what it removes:

- **Visibility & transparency layer** — every compaction pass surfaces what it did.
- **Preservation contract + digest schema** — pinned content is provably preserved
  (sha256 digest, not a promise).
- **Minimal-surgery algorithm** — the pruner removes the least-controversial material
  first instead of truncating.
- **Evidence spill + `requiresRawEvidence` splice** — oversized evidence goes to disk,
  not into the void; consumers that need raw evidence get it rehydrated.
- **Removed-content ledger + metrics + model notice** — a running account of what was
  removed and why, surfaced to both the operator and the model.
- **`/compact` summary output (FID-2026-0828-001)** — forcing a compact now emits the
  pruner's summary as a first-class, collapsed-by-default transcript block with
  expand/collapse and a whole-block copy button. Live-verified 2026-08-28.

### Eval system rebuild v3 (FID-2026-0824-013 + children)

The benchmark harness was rebuilt to measure what actually matters:

- **FSM alignment + trajectory assertions** — evals assert the Perfection Loop path taken,
  not just the final text.
- **Sandbox hardening** — eval tasks run fail-closed.
- **Skill-efficacy engine + erosion regression guard** — skills are measured for effect and
  regressions trip the gate.
- **Governance corpus + bounded autorater + Tier-1 pre-push smoke** — a governance task
  family runs on every push.
- **Capability ingestion + Tier-3 release pipeline** — release promotion is evidence-gated.

**Results: benchmark v2 = 9/9 PASS (0 errors, 0 timeouts); Tier-1 governance smoke = 5/5.**

### Desktop (Tauri v2): chat, dashboard, and the command deck

- **Structured chat surface (FID-2026-0820-010)** — the full engine without a terminal:
  bounded transcript virtualization, markdown blocks with per-message copy,
  traffic-light status panels, phase stepper, composer auto-grow, timestamps under
  messages, real model-resolved context window.
- **Auto Drive dashboard** — authoritative lifecycle counts, run controls, and
  **Emergency Halt**.
- **Project FIDs rail** — the repo's live FID queue over the gateway, with the boot-sync
  fix (initial inventory now arrives on connect — panel went 0 → 27 open).
- **Sidecar boot fix (FID-2026-0901-001)** — env forwarding to the sidecar fixed the
  desktop boot crash-loop and chat-send failures.
- **Command deck rebuilt (FID-2026-0831-001/-002)** — the 3D floor is now a neon-noir
  agent office rendered with React Three Fiber: a 10-agent robot cast with per-role
  accents and glowing rims, agents walking to tool stations on live tool calls,
  obstacle-aware routing, activity beacons + thinking dots + spark bursts, speech
  bubbles tracking the conversation, day/night lighting, break furniture,
  click-to-focus + follow-cam, and a mini-chat island so you can message the agent
  without leaving the deck.

### Discord Rich Presence refinements

Enabled by default with a mechanical privacy boundary (paths, tool arguments, FID titles,
and search queries redacted; fail-closed Zod fallback). The three-line activity layout
(project / model / action) replaces the single dense line, model labels are
provider-trimmed (`nous/meituan/longcat-2.0:free` → `longcat-2.0`,
`openrouter/free` → "OpenRouter Free"), and the client id is compiled in against the
Savant Discord application — never operator-mutable.

### Harness hardening & fixes

- **Laws 1/4 universal hard blocks** (FID-2026-0823-007) and Forge Law-1 deadlock fix
  (FID-2026-0824-031) at the EHEL enforcement layer.
- **Recorder reliability** — context-bloat stall root-caused and fixed with a corrective
  retry ladder (FID-2026-0823-011/-012/-014).
- **Sidebar context readout** — no more "context stuck at 0/x" near session start
  (FID-2026-0827-001).
- **Nous free-model 400 fix** — the undocumented required `tags` body field is injected
  on both routing paths.
- **Hybrid-mode retuning** — full Perfection Loop escalation threshold moved 20 → 100 lines.
- **Model migration** — default model is now `z-ai/glm-5.3-flash`.
- **Repo hygiene** — the 644-path backlog drained into 27 path-scoped atomic commits;
  `dev/scratchpad/` is now auto-managed by a hygiene guard.

## Verification (all gates re-run 2026-09-02)

| Gate | Result |
|---|---|
| Typecheck ×4 (sdk, common, agent-runtime, cli) + desktop | exit 0 |
| Suites (desktop / cli / common / sdk / echo) | 352 / 1362 / 658 / 493 / 157 pass — 0 fail |
| ESLint (`--max-warnings 0`) · Prettier · markdownlint · hygiene | PASS |
| Benchmark v2 | **9/9 PASS** |
| Tier-1 governance smoke | **5/5 PASS** |
| `fid:verify --check` | PASS (291 archived + 13 active FIDs) |

**Known debt (declared, not hidden):** 298 `quality.ratchet` file-length violations remain
under the deliberately paused decomposition program (FID-2026-0819-005) — 287 pre-existed
at v0.0.27; the deck/desktop growth added the rest and is queued for that program. Nova's
independent release audit returned **PASS on all five verdicts — cleared for ship**
(2026-09-02: `dev/nova/outbox/2026-09-02-release-ready-audit-v0.0.28-nova-signoff.md`, with
the audit request at `…-nova-signoff-request.md`).

## Install / upgrade

```sh
npm install -g savant-code@0.0.28
```

Existing sessions upgrade in place; `/presence` is on by default (disable with
`/presence disable`). Desktop builds ride the same version from the `desktop/` workspace.

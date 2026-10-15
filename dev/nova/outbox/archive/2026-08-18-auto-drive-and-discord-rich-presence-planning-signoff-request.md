<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Planning Sign-off Request — Auto Drive program (FID-2026-0818-001..008) + Discord Rich Presence (FID-2026-0818-009)

**Date:** 2026-08-18
**Scope:** Planning review of the **entire active FID queue** — the Auto Drive program (master `FID-2026-0818-001` + children `002`–`008`) and the standalone Discord Rich Presence FID (`FID-2026-0818-009`). All nine records ran the Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT) with grep-verified Law-4 evidence and **no code written** (Law 2 — Present Before Act). No implementation has begun on any record.
**Status:** REQUESTED
**Priority:** High (operator-directed; two features — autonomous end-to-end execution on the governed harness, and an in-process Discord presence surface — both converged and awaiting approval).

## Request

Please independently audit the **planning** of the nine records below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies each plan's ground-truth claims against the repo (the cited `file:line` sources exist and describe what the FID says they describe). It does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request per record) follows operator approval.

Governing protocol: `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO, `strict_mode: true`). Approved-scope audit trail: `SCOPE.md` (Tasks 3 and 4). Mechanical gate: `bun run validate:repository` currently **PASS**.

## Records under review

| Record | Scope | Current status | Fix surface |
|---|---|---|---|
| `dev/fids/FID-2026-0818-001-auto-drive-master.md` | Auto Drive coordination master (driver-on-goal-engine, one approval gate, child manifest) | `analyzed` | coordination — no code |
| `dev/fids/FID-2026-0818-002-drive-mode-entry.md` | `/auto` entry: clarity, pre-build plan, one-time approval, tool filtering, inline plan editing, `--auto` flag | `analyzed` | `cli/src/commands/`, `cli/src/state/`, `packages/agent-runtime/src/run-agent-step/`, `common/src/util/goal-directives.ts` |
| `dev/fids/FID-2026-0818-003-decomposition-engine.md` | spec → master FID + child FIDs; plan↔FID manifest check | `analyzed` | `agents/thinker|detective|recorder`, `packages/agent-runtime/src/run-agent-step/decomposition/` |
| `dev/fids/FID-2026-0818-004-drive-loop-supervisor.md` | FID queue, phase-completion validation from the FID file, legal `transition_phase`, archive + CHANGELOG, zero-open-FID | `analyzed` | `packages/agent-runtime/src/run-agent-step/`, `echo/fid-validator.ts`, `agents/savant/` |
| `dev/fids/FID-2026-0818-005-self-healing-ladder.md` | 7-rung failure router + `## Run Log` (deferred presentation) | `analyzed` | `packages/agent-runtime/src/run-agent-step/ladder-router.ts`, `agents/recorder|thinker|detective` |
| `dev/fids/FID-2026-0818-006-completion-certification.md` | triple gate: zero-open-FID + goal-conformance audit + `/verify` | `analyzed` | `packages/agent-runtime/src/run-agent-step/goal-conformance.ts`, `agents/scribe` |
| `dev/fids/FID-2026-0818-007-observability-long-session-bounds.md` | `/auto status`, sidebar queue, Esc pause/stop, crash resume, `/export` Run Log, Immer trims, FID-boundary compaction | `analyzed` | `cli/src/state/`, `cli/src/components/`, `cli/src/commands/` |
| `dev/fids/FID-2026-0818-008-headless-cli-mode.md` | `--auto "<goal>"` non-TUI entry, non-interactive approval, stdout + exit codes, crash resume | `analyzed` | `cli/src/cli-args.ts`, `cli/src/index.tsx`, `packages/agent-runtime/src/run-agent-step/` |
| `dev/fids/FID-2026-0818-009-discord-rich-presence.md` | in-process Discord Rich Presence (IPC, state+privacy, mapper, `/presence` commands) | `analyzed` | `cli/src/state/presence/`, `cli/src/commands/`, `cli/src/utils/settings/` |

## What each record claims (verify each at source)

### Master 001 — Auto Drive coordination

- Auto Drive is a **driver, not an 11th agent**: it extends the goal driver and drives the existing STRICT ceremony (`agents/savant/savant-strict.ts`; `agents/savant/system-prompt.ts:35` — "No direct writes, no phase skipping, no self-verification").
- **FID file is ground truth**: phase completion is validated by reading the FID, never by self-report. The parsers exist (`packages/agent-runtime/src/echo/fid-validator.ts`, `scripts/fid-ledger.ts`).
- **One approval gate**: the pre-build plan confirmation carries the Law 2 approval; resolution policy = documented most-robust-default; genuine impasse = terminal block.
- **Queue = anti-deferral**: completion requires zero open FIDs AND the goal-conformance audit; discoveries become new FIDs (FID-2026-0817-005 gates stay intact).
- **Status vocabulary**: `analyzed` (not `converged`) because `scripts/fid-ledger.ts:18-23` rejects `converged` in the active set (recorded drift, FID-2026-0817-005 Missed Question 1 — a separate operator call, not this program).
- **No `/auto` exists today**: `cli/src/commands/command-registry.ts` (read 2026-08-18) has no `auto` command.

### Child 002 — drive-mode entry

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `/interview` exists and ends in a spec + `suggest_followups`, no approval gate. | `cli/src/commands/defs/misc.ts:67,87` |
| C-02 | `INTERVIEW_BASE_PROMPT` (context → ≥3 `ask_user` rounds → spec → no code) is reusable for the clarity check. | `cli/src/commands/prompt-builders.ts:62-75` |
| C-03 | `filterToolSet` is the pure allowlist seam to strip `ask_user`/`suggest_followups`/`end_turn`. | `packages/agent-runtime/src/tools/filter-tool-set.ts:10`; applied at `packages/agent-runtime/src/run-agent-step/loop-context.ts:19,169` |
| C-04 | `<drive-lock>` directive mirrors `serializeGoalSetDirective`. | `common/src/util/goal-directives.ts:44-53` |

Plan: `/auto "<goal>"` → clarity (interview if underspecified) → Thinker pre-build plan → one `ask_user` Confirm/Revise/Cancel (with inline plan editing) → `<drive-lock>` + tool filtering + STRICT pin (`savant-strict`). Headless entry flag `--auto` in `cli-args.ts` (routed per child 008).

### Child 003 — decomposition engine

| ID | Claim | Cited source |
|---|---|---|
| C-01 | Detective's knowledge-graph tools (`query_blast_radius`, `query_node_edges`, `query_domain_clusters`) are registered; RED cataloging contract. | `agents/detective/detective.ts:61-63,145-146` |
| C-02 | Recorder is the sole FID author; tools exclude `str_replace`; CREATE = complete content supplied by orchestrator. | `agents/recorder/recorder.ts`, `ECHO.md` |
| C-03 | Ledger graph rules (one master; children declare master; master lists children; deps exist) are the floor for the manifest check. | `scripts/fid-ledger.ts:72-130` |

Plan: Thinker milestones → Detective grounding (blast-radius, oversize split) → Recorder batch FIDs (status `created`) → **bidirectional** manifest check (plan ⊆ FIDs AND FIDs ⊆ plan) → fail regenerates missing FIDs before drive starts.

### Child 004 — drive-loop supervisor

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `PerfectionLoopPhase` vocabulary. | `common/src/types/session-state.ts:220` |
| C-02 | `transition_phase` is a registered tool with FSM-validated transitions. | `agents/types/tools.ts:41,86` |
| C-03 | `archivedFidExists` (closed + CHANGELOG + evidence headings) is the COMPLETE check to reuse. | `scripts/fid-ledger.ts:44-58` |
| C-04 | Section + step-status parsers exist and are exported. | `packages/agent-runtime/src/echo/fid-validator.ts` |

Plan: queue = `dev/fids/` scan + master manifest; per-FID phase machine checks the FID file for phase evidence (`### RED`, `### GREEN`, `### Code Verification Evidence`, Adversary verdict) before any legal `transition_phase`; archive + CHANGELOG at COMPLETE; supervisor is **read-only** over FIDs (never authors evidence).

### Child 005 — self-healing ladder

| ID | Claim | Cited source |
|---|---|---|
| C-01 | EHEL mechanical block shape (`blocked: true, reason`). | `packages/agent-runtime/src/echo/pre-write-gates.ts` |
| C-02 | `compliance_warning` receipts exist (Law 1/3 steering). | `common/src/types/print-mode.ts`, `packages/agent-runtime/src/util/echo-compliance.ts` |
| C-03 | Circuit breakers (iterationCount, oscillation, 10% cap) and the SELF_CORRECT/RED re-entry edges. | `ECHO.md` |
| C-04 | Anti-deferral contract the ladder must satisfy. | FID-2026-0817-005 (archived) |

Plan: 7 rungs (mechanical retry → SELF_CORRECT → RED re-analysis → new-FID-on-discovery → documented default → compaction → terminal block); oscillation keyed by issue signature **and** rung; every event appended to the master FID `## Run Log`.

### Child 006 — completion certification

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `completionCriterion` is serialized but never evaluated (model claim only). | `common/src/types/session-state.ts:149`; `packages/agent-runtime/src/run-agent-step/goal-engine.ts:275-276` |
| C-02 | `/verify` runs the four workspace typechecks. | `cli/src/commands/defs/chat.ts:109` |
| C-03 | `validate:repository` proves queue-empty + no unresolved steps. | `scripts/fid-ledger.ts` |

Plan: triple gate — queue-empty AND goal-conformance (criterion registry checked against the repo: tests/typecheck/feature-grep/file-existence) AND `/verify`; gaps → new FIDs → drive continues; Scribe cross-checks the CHANGELOG with attributed findings only.

### Child 007 — observability + long-session bounds

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `AgentActivity` kinds are the drive-status broadcast channel. | `common/src/types/session-state.ts:110` |
| C-02 | Zustand + Immer stores are the trim targets. | `cli/src/state/chat-store.ts` |
| C-03 | `/export` is the handoff artifact. | `cli/src/commands/export-conversation.ts` |
| C-04 | L0-L3 compaction machinery exists (proactive at FID boundaries). | `agents/context-pruner/` |

Plan: `/auto status` + sidebar drive panel; Esc pause/stop; crash resume from FID scan + manifest; `/export` gains Run Log + certification sections; destructive Immer trims + cache caps; FID-boundary compaction.

### Child 008 — headless CLI mode

| ID | Claim | Cited source |
|---|---|---|
| C-01 | `--print` is the existing headless seam ("run headlessly … non-zero exit on failure"). | `cli/src/cli-args.ts:24-25,104-105,196` |
| C-02 | `--prompt-file` (the `--spec` parse pattern) and `--continue` (resume) exist. | `cli/src/cli-args.ts:100,92` |
| C-03 | `/verify` and `/export` handlers exist for the non-interactive report + exit code. | `cli/src/commands/defs/chat.ts:88`; `cli/src/commands/export-conversation.ts:29` |
| C-04 | `/goal` + `serializeGoalSetDirective` is the directive pattern. | `cli/src/commands/goal.ts:32` |

Plan: `--auto "<goal>" [--spec <path>] [--plan-file <path>] [--approve] [--plan-only]`; headless requires a full spec (no fake interview); non-interactive Law 2 = `--plan-file` (reviewed) or `--approve` (explicit trust), both recorded; exit 0 only on the 006 triple gate; resume via `--continue` + FID scan.

### Child 009 — Discord Rich Presence (standalone FID)

| ID | Claim | Cited source |
|---|---|---|
| C-01 | No existing presence code (grep `discord|RPC|presence` → only the community link). | `WINDOWS.md:230` |
| C-02 | `zod ^4.2.1` is a real CLI dependency, already imported. | `cli/package.json:60`; `cli/src/utils/auth.ts:5` |
| C-03 | settings.json persistence exists (the preference home — NOT credentials.json). | `cli/src/utils/settings/io.ts` (`getSettingsPath`/`saveSettings`); `cli/src/utils/settings/preferences.ts` |
| C-04 | `/telemetry` + `/permissions` are the `/presence` command pattern. | `cli/src/commands/telemetry.ts`; `cli/src/commands/defs/chat.ts` |
| C-05 | `@xhayper/discord-rpc` is the maintained, type-safe fork of `discordjs/RPC` (`Client`/`setActivity`/`login`). | repo `xhayper/discord-rpc` → `Khaomi/discord-rpc` (web-verified) |

Plan: library-first (`@xhayper/discord-rpc`); raw IPC is an **evidence-gated fallback** (only if the blueprint's unverified "Bun Windows named-pipe anomaly" is reproduced — it is cited to unrelated issues, so it must not drive the design blind). Mechanical redaction (basename only, tool args dropped absolutely, FID numeric ID only, query mask) + Zod outbound schema that rejects `/`/`\` with a fail-closed safe payload. Rich Presence only — Embedded App SDK "Activities" is out of scope (operator-confirmed; needs a hosted HTTPS app + live egress, conflicting with local-first/zero-cloud).

## Hard questions Nova must verify at source

### Master 001

1. Confirm `cli/src/commands/command-registry.ts` has no `auto` command (read 2026-08-18), and `agents/savant/savant-strict.ts` is the STRICT agent the driver pins.
2. Confirm `scripts/fid-ledger.ts:18-23` rejects `converged` in the active set, so `analyzed` is the correct planning status (and the drift is flagged, not absorbed).
3. Confirm the master adds no code and authorizes no implementation on its own (Law 2), and its child manifest (002–008) is complete.

### Child 002

1. Confirm `filter-tool-set.ts:10` is a pure allowlist and `loop-context.ts:169` is the model-facing boundary where drive-mode filtering lands (executor authorization unchanged — defense in depth preserved).
2. Confirm `goal-directives.ts:44-53` is the directive serialization pattern `<drive-lock>` mirrors.
3. Confirm the inline-plan-edit + `--auto` flag additions are captured in the FID's steps 8–9 (no silent v1/v2 phasing).

### Child 003

1. Confirm `agents/detective/detective.ts:61-63` registers the three graph tools and `:145-146` is the RED cataloging contract.
2. Confirm the manifest check is **bidirectional** (plan ⊆ FIDs and FIDs ⊆ plan) — a missing FID is a silent drop, an extra FID is unapproved expansion; both must fail.
3. Confirm the Recorder CREATE workflow (complete content supplied by orchestrator, no `str_replace`) is respected by the batch-authoring contract.

### Child 004

1. Confirm `common/src/types/session-state.ts:220` is `PerfectionLoopPhase` and `agents/types/tools.ts:41` registers `transition_phase` with FSM-validated transitions.
2. Confirm `scripts/fid-ledger.ts:44-58` (`archivedFidExists`) requires `closed` + CHANGELOG + evidence headings, and the supervisor reuses it as the COMPLETE check.
3. Confirm the supervisor is **read-only over FIDs** (evidence authored by agents; supervisor only parses) — separation of duties preserved under automation.

### Child 005

1. Confirm `pre-write-gates.ts` returns `{ blocked: true, reason }` and `echo-compliance.ts` emits `compliance_warning` receipts (rung 1 inputs).
2. Confirm the ladder's documented-default rung keeps the step `[x]` (a *decision*, not a deferral) so the anti-deferral gate passes — and true "cannot implement" routes to rung 7, never a silent marker.
3. Confirm oscillation is keyed by issue signature **and** rung (a re-analysis changes the signature, so the 3-strike breaker fires only after a rethink).

### Child 006

1. Confirm `goal-engine.ts:275-276` serializes `<untrusted_completion_criterion>` but never evaluates it — i.e., completion is a model claim today, not a verification.
2. Confirm `/verify` (`defs/chat.ts:109`) is the four-workspace typecheck gate the audit reuses.
3. Confirm the Scribe cross-check produces **attributed findings**, not pass/fail decisions (Cross-Agent Claim Rule).

### Child 007

1. Confirm `session-state.ts:110` `AgentActivity` kinds are the reuse surface (no new activity model), and `chat-store.ts` is Zustand + Immer.
2. Confirm `/export` (`export-conversation.ts`) and the L0-L3 compaction layers (`agents/context-pruner/`) are the reuse points for the handoff report and FID-boundary compaction.
3. Confirm crash resume is FID-scan + master-manifest (no bespoke persistence) — FIDs are already durable.

### Child 008

1. Confirm `cli-args.ts:104-105` documents `--print` as "non-zero exit on failure" (the headless seam), and `--continue` (`:92`) / `--prompt-file` (`:100`) exist for resume and `--spec`.
2. Confirm headless requires a full spec and **fails closed** (no fake interview) — a missing spec is a hard error, not a skipped interview.
3. Confirm the non-interactive approval requires an explicit signal (`--plan-file` or `--approve`) and records it; a headless run with neither exits non-zero before any work.

### Child 009

1. Confirm `cli/package.json:60` pins `zod ^4.2.1` and `cli/src/utils/auth.ts:5` already imports it (the Zod-schema plan is grounded).
2. Confirm `cli/src/utils/settings/io.ts` (`getSettingsPath`/`loadSettings`/`saveSettings`) is the persistence seam, and the FID uses **settings.json**, not credentials.json (the blueprint's wrong home is corrected).
3. Confirm `@xhayper/discord-rpc` is a real, maintained, type-safe `discordjs/RPC` fork (repo `xhayper/discord-rpc` → `Khaomi/discord-rpc`), and the raw-IPC fallback is gated on reproduced Windows evidence — not built on the blueprint's unverified claim.
4. Confirm the redaction is absolute (tool args never inspected/forwarded) and the Zod schema rejects `/`/`\` with a fail-closed safe payload — no path reaches the transport.

## Adversarial checks already run in the records' Perfection Loops

- 001: single up-front approval ≠ blank check (anti-deferral + ledger still enforce); STRICT preserved verbatim; `validate:repository` PASS with `analyzed` + `blocked::` markers.
- 002: tool filtering at the model boundary (executor authorization unchanged); Revise never half-locks drive mode; child 003's manifest closes plan-coverage gaps.
- 003: Recorder batch size capped (pagination) to avoid context limits; greenfield milestones ground to parent workspace; structural validator runs at queue intake.
- 004: presence-check is the floor, Verifier/Adversary verdicts are the truth layer; circuit breakers bound AUDIT↔SELF_CORRECT loops; archive move is synchronous with CHANGELOG.
- 005: documented default is a decision not a deferral; discovery-FID queue growth bounded by 007 observability + Esc; re-analysis bounded by iteration + oscillation counters.
- 006: gap loop terminates by the ladder's breakers; criteria are operator-approved at entry; Scribe findings are attributed.
- 007: trims apply to ephemeral TUI arrays only (evidence lives in FID files + Run Log); Esc pause is control, not a confirmation; L3 restart recovers position from disk.
- 008: `--approve` is an explicit, recorded trust signal (reviewed `--plan-file` is the CI default); tool filtering + fail-closed prevents any `ask_user` hang; exit 0 requires the 006 triple gate.
- 009: absolute argument dropping removes the argument-leak class; Zod + safe-payload fallback is the mechanical backstop; one `sanitizeAndValidate` entry point means the mapper cannot receive unsanitized state.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks each plan converged and code-grounded; **operator approval is then required before any code is written**, and a separate implementation-audit request must precede each record's closure. The two programs are planning-only today; the Discord "Activities" (Embedded App SDK) surface and the Auto Drive non-goals (ghost-review worker, single-agent variant) are explicitly out of scope and not reopened by this request.

## Expected response

1. Overall verdict.
2. Verdict per record (001–009).
3. Verdict per hard question with `path:line` + quoted code/command output.
4. Any missing citation, scope contradiction, or unverified claim.
5. Explicit confirmation this is planning review only and does not authorize production changes or release activity.

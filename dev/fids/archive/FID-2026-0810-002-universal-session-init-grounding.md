<!-- markdownlint-disable MD013 -->

# FID: Universal Session-Init Grounding — Local-First Reads with Embedded Protocol Fallback

**Filename:** `FID-2026-0810-002-universal-session-init-grounding.md`
**ID:** FID-2026-0810-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-10
**YAGNI-Compliance:** Verified

> **Planning-only boundary (resolved):** This FID defined and converged the
> universal session-init grounding work. Implementation was approved by the
> operator (automation level 3, 2026-08-10) and is complete; see the
> Implementation Summary in Resolution below. Historical planning gate text
> preserved for the record.
>
> **Operator decisions recorded (2026-08-10):** (1) grounding is baked in as
> the primary source with the local-file read retained as the session ritual;
> (2) when the local protocol files are absent, the boot flow loads them from
> the embedded copies — it does NOT crash and does NOT scaffold files into the
> user's project; (3) the embedded copies are generated from the repo files so
> they stay in sync (drift-checked); (4) all of this work is folded into this
> single FID; (5) the bundle carries the **harness grounding set** — `ECHO.md`,
> `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`, and
> `templates/FID-TEMPLATE.md` — so the entire session-init ritual is
> synthetic-read resolvable in any install. The single-agent document
> (`dev/echo-v0.1.2-single-agent.md`) is **completely out of scope**: it is
> NOT part of the savant-code product — it is the protocol of a third-party
> harness (with different laws) that the operator uses when building without
> the savant-code harness. The savant-code harness never selects it, never
> references it, and this FID makes **zero changes** to the single-agent
> machinery; it is excluded from the bundle. Repo history (`dev/fids/`
> content, `session-summaries/`, `nova/`, `exports/`, `scratchpad/`) is
> never embedded or materialized.

---

## Summary

Savant does not reliably perform its session-init grounding reads. The first
message of a fresh session was answered with a full text reply while the agent
had read **none** of its grounding files (`ECHO.md`, `ARCHITECTURE.md`,
`protocol.config.yaml`, `dev/LEARNINGS.md`). This is not a prompt-staleness
problem — the system prompt explicitly instructs the reads — it is a
harness-enforcement gap with two independent holes, plus a packaging gap that
would make the reads impossible for npm-installed copies:

1. **The tool-level session-init gate is strict-mode-only.** The gate in
   `EchoEnforcement.beforeToolCall`
   (`packages/agent-runtime/src/echo/enforcement.ts:79`) only fires when
   `tier === 'all_15'` (i.e. `enforcementMode === 'strict'`). In HYBRID — the
   default mode — the gate never runs, so any tool is usable before the
   protocol is read.
2. **A text-only answer bypasses the gate entirely, even in strict mode.** The
   gate is evaluated per tool call. If the model replies to a greeting with a
   message and zero tool calls, `shouldEndTurn` is true
   (`packages/agent-runtime/src/run-agent-step/step.ts:323-336`), the turn
   ends, and the ungrounded answer is streamed to the user. No layer checks
   whether the boot reads ever happened.
3. **The boot contract requires the protocol files in the user's cwd and
   crashes without them.** `resolveBootContract`
   (`common/src/util/boot-contract.ts:79-93`) throws when
   `protocol.config.yaml` or the protocol file cannot be read, and
   `sdk/src/run-state/initial-state.ts:35-37` calls it on every session (the
   CLI sets `protocolVariant: 'harness'`). An npm install run inside an
   arbitrary project (no `ECHO.md`, no `protocol.config.yaml`) would crash at
   session start. The full protocol document is not embedded — only the
   condensed `ECHO_PROTOCOL_INSTRUCTIONS` block
   (`common/src/constants/agents.ts:109`) is baked into the shipped bundle.
   And `ECHO.md` can update often, so any embedded copy must be generated
   from the canonical file and drift-checked to stay in sync.

The fix makes grounding **universal and deterministic**: in every mode
(HYBRID, STRICT, ANALYZE, SCAFFOLD, PLAN, DEFAULT), interactive and headless,
SavantFree and full product, and SDK boot contracts — the first turn is
grounded via **local-first reads with an embedded full-file fallback served
through the same read path** (a read of the protocol file always succeeds:
from the local file, or from the embedded copy when the file is absent), and
the harness guarantees no answer and no non-read tool call precedes the
grounding.

## Environment

- **OS:** Windows (win32), bash / PowerShell
- **Language/Runtime:** TypeScript strict monorepo; Bun 1.3.14
- **Branch:** `main` (uncommitted working tree; 0.0.23 pending, unreleased)
- **Version:** `0.0.23` (pending)
- **Boot contract:** harness variant → `ECHO.md` v0.2.0 strict (restored to
  harness this session; the CLI no longer hard-codes `single-agent` — see
  `cli/src/hooks/helpers/send-message-run-config.ts:189` and
  `cli/src/headless-run.ts:187`)
- **Deployment modes:** repo/dev (files present), npm install in an arbitrary
  project (files absent → embedded fallback), SavantFree binary, SDK embed

## Detailed Description

### Problem

Observed behavior (operator-pasted, this session): the first message `hello`
produced a complete assistant answer that described the repo and offered next
steps — with zero grounding reads. The boot response also previously cited the
single-agent protocol file (fixed by the harness-contract change), but the
deeper defect remains: **nothing forces the boot reads to happen, in any mode,
and the reads are impossible when the files are absent.**

The system prompt promises enforcement that does not exist:

> `agents/savant/system-prompt.ts:115`
> "**Session init (FID-2026-0806-005):** read `{SAVANT_CODE_PROTOCOL_FILE}`
> 0-EOF before any non-read tool call — **the harness blocks other tools until
> you do.** Also read `ARCHITECTURE.md`, `protocol.config.yaml`, and
> `dev/LEARNINGS.md` at session start."

The promise is true only in strict mode, only when the agent *calls a tool*,
and only when the files exist in the cwd.

### Expected Behavior

Every main-agent session must begin with a deterministic boot sequence,
regardless of mode or installation:

1. **Local-first:** on the first message of a fresh (or resumed) session, the
   agent's first actions are the grounding reads of the resolved harness
   protocol file 0-EOF (`ECHO.md`), plus `ARCHITECTURE.md`,
   `protocol.config.yaml`, and `dev/LEARNINGS.md` — when those files exist in
   the cwd. (The SDK single-agent variant is out of scope: it belongs to a
   third-party harness and is untouched by this FID.)
2. **Embedded fallback:** when the grounding files are absent (npm install in
   an arbitrary project), the **same read path** serves the **full** grounding
   set from the embedded copies baked into the runtime — reads of `ECHO.md`,
   `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`, and
   `templates/FID-TEMPLATE.md` resolve to the embedded documents, so the boot
   ritual and the enforcement gate behave identically to the local-file case.
   No crash, no scaffolding of files into the user's project, no pre-seeded
   gate.
3. **Single source of truth:** the repo files remain canonical; the embedded
   copies are generated from them and a drift check fails validation when they
   fall out of sync (they update often and must track each other).
4. Until grounding completes, the harness must not emit a final answer, and
   must not execute non-read tools — in **every** mode (the current
   strict-only gate becomes universal).
5. Subagents remain exempt (they inherit the parent's read via
   `protocolPreSeeded`).
6. The behavior is the same in interactive TUI, headless `--print`, SavantFree,
   and SDK-driven sessions (they share the loop).
7. A misbehaving model cannot deadlock the session: grounding steering is
   bounded, with a documented escape hatch.

### Root Cause

Five interacting gaps:

**A. The session-init gate is gated on strict mode.**
`packages/agent-runtime/src/echo/enforcement.ts:20-21` maps
`enforcementMode` → tier (`strict` → `all_15`, anything else → `core_4`), and
`:79` only enforces the gate at `all_15`. Since the CLI maps every non-STRICT
mode to `hybrid`
(`cli/src/hooks/helpers/send-message-run-config.ts:185`:
`enforcementMode: agentMode === 'STRICT' ? 'strict' : 'hybrid'`), the gate is
off for HYBRID/ANALYZE/SCAFFOLD/PLAN/DEFAULT — the modes users actually use.

**B. The gate only fires on tool calls; a text completion ends the turn.**
The gate lives in `beforeToolCall`
(`packages/agent-runtime/src/echo/enforcement.ts:78-89`). The turn-end decision
in `packages/agent-runtime/src/run-agent-step/step.ts:323-336` ends the turn on
`hasNoToolResults && !isThinkOnly` with no grounding check, and
`loop.ts:192` breaks the loop on `!iteration.shouldContinue`. A greeting
answered with pure text therefore streams out ungrounded. `protocolRead` never
even becomes tracked, because the enforcement instance is created **lazily on
the first tool call**
(`packages/agent-runtime/src/tools/tool-executor/native.ts:247-259`) — for a
text-only first turn, no `EchoEnforcement` instance exists at all.

**C. Enforcement state is in-memory only.**
`protocolRead` lives in the `EchoEnforcement` instance
(`packages/agent-runtime/src/echo/enforcement-state.ts:27`), which is stored on
`agentState._echoEnforcement` and is not serialized with the session. Every
session start (including resume from run-state storage) constructs a fresh
instance with `protocolRead: false` — which is actually the desired
re-grounding semantics, but currently means nothing because the gate is off in
non-strict modes and bypassable by text.

**D. The boot contract fails closed on absent local files.**
`resolveBootContract` (`common/src/util/boot-contract.ts:79-93`) throws when
`protocol.config.yaml` or the selected protocol file cannot be read, and
`sdk/src/run-state/initial-state.ts:35-37` invokes it whenever
`protocolVariant` is set (always, for the CLI). There is no embedded fallback:
the full `ECHO.md` is not bundled; only the condensed
`ECHO_PROTOCOL_INSTRUCTIONS` block
(`common/src/constants/agents.ts:109`, injected via `agents/savant/prompts.ts`
and baked into `bundled-agents.generated.ts`) ships with the product.

**E. The condensed embedded protocol can drift from the full document.**
`ECHO_PROTOCOL_INSTRUCTIONS` and the 15-turn refresh
(`packages/agent-runtime/src/echo/protocol-summary.ts`, ~500 tokens) are
hand-maintained condensed copies of `ECHO.md`. They already disagree with the
current no-signature policy — `protocol-summary.ts:26-27` still says "Sign all
authored documents as Savant only" — proving the drift is real.

### Evidence

- `packages/agent-runtime/src/echo/enforcement.ts:20-21` — `getTier` maps mode
  to `core_4`/`all_15`.
- `packages/agent-runtime/src/echo/enforcement.ts:79` — session-init gate fires
  only when `tier === 'all_15'`.
- `packages/agent-runtime/src/echo/enforcement.ts:80-83` — gate clears when a
  read targets the resolved protocol path (`isProtocolReadCall`).
- `packages/agent-runtime/src/echo/enforcement.ts:326-331` — pre-read allowed
  tools: `read_files`, `read_subtree`, `ask_user`, `write_todos`.
- `packages/agent-runtime/src/tools/tool-executor/native.ts:247-259` — lazy
  `EchoEnforcement` construction; mode from `agentState.enforcementMode`;
  `protocolPreSeeded: Boolean(agentState.parentId)`.
- `cli/src/hooks/helpers/send-message-run-config.ts:185` — every non-STRICT
  mode → `hybrid`; `:189` — `protocolVariant: 'harness'` (boot contract fix).
- `cli/src/utils/create-run-config.ts:200` — default `enforcementMode` is
  `hybrid`.
- `packages/agent-runtime/src/run-agent-step/step.ts:323-336` — text-only
  completion ends the turn with no grounding check.
- `packages/agent-runtime/src/run-agent-step/loop.ts:192` — loop breaks on
  `!iteration.shouldContinue`.
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:333-358` —
  existing corrective-steering pattern (`ECHO_COMPLIANCE` + `takeSteeringMessages`);
  `:361-368` — 15-turn refresh only runs when `_echoEnforcement` exists.
- `agents/savant/system-prompt.ts:115` — the unfulfilled "harness blocks other
  tools" promise.
- `packages/agent-runtime/src/echo/enforcement-state.ts:27` —
  `protocolRead: false` initial state.
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:197` —
  hybrid gate no-op assertion (must change); `:96` — Law 7 steering no-op
  (must **not** change).
- `common/src/util/boot-contract.ts:79-93` — throws when the selected protocol
  file or `protocol.config.yaml` contract is absent/unreadable.
- `sdk/src/run-state/initial-state.ts:35-37` — `resolveBootContract` runs on
  every session when `protocolVariant` is set.
- `common/src/constants/agents.ts:109-110` — `ECHO_PROTOCOL_INSTRUCTIONS` (the
  only hard-coded protocol block today); injected at
  `agents/savant/prompts.ts:53,144,172,205` and `agents/thinker/thinker.ts:95`.
- `packages/agent-runtime/src/echo/protocol-summary.ts:26` and `:58` — stale
  signing instruction ("Sign all authored documents as Savant only") that
  contradicts the current no-signature policy, **plus the only two hard-coded
  single-agent references in harness-injected context**: the
  "single-agent adaptation v0.1.2" mention in the governing-law line (`:26`)
  and the `## Double audit (single agent)` heading (`:58`, lifted from the
  single-agent document's "Double Audit (Single-Agent)" section) — both in
  the 15-turn refresh the harness itself injects. Purged by Change 6.
- `cli/src/hooks/helpers/send-message-run-config.ts:187-189` +
  `cli/src/headless-run.ts:183-186` — the harness product always selects
  `protocolVariant: 'harness'` (comments cite the operator directive); the
  single-agent variant is an SDK opt-in for third-party harnesses, never the
  CLI default.
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:163,167,181,185`
  — fixture protocol path uses `dev/echo-v0.1.2-single-agent.md`; switched to
  `ECHO.md` (Change 6) so the harness test surface stops referencing the
  outside-agent document.

### Impact Assessment

- Without grounding, the agent operates with zero protocol/law context in the
  modes users actually run, contradicting the product's ECHO-governance story
  and the system prompt's explicit promise.
- npm-installed copies in arbitrary projects cannot boot (fail-closed contract
  on absent files) — a real product blocker.
- The failure is silent: no warning, no error — just an ungrounded answer.
- Scope is cross-layer: protocol content/embedding, boot resolution,
  enforcement, run loop, prompt text, and a wide test surface.

#### Affected Components

- `common/src/constants/protocol-bundle.generated.ts` (new) — embedded
  harness grounding set (ECHO.md, ARCHITECTURE.md, protocol.config.yaml,
  dev/LEARNINGS.md, templates/FID-TEMPLATE.md) generated from the repo files;
  single-agent doc NOT bundled
- `scripts/generate-protocol-bundle.ts` (new) + drift check — sync mechanism
- `common/src/util/boot-contract.ts` — local-first resolution with embedded
  fallback (never throws on absence)
- `sdk/src/run-state/initial-state.ts` — protocol source mode + synthetic-read
  wiring
- `packages/agent-runtime/src/echo/enforcement.ts` — universal gate +
  completion-gate state
- `packages/agent-runtime/src/tools/tool-executor/native.ts` — shared factory
- `packages/agent-runtime/src/run-agent-step/loop.ts` / `loop-iteration.ts` —
  eager enforcement + first-turn completion gate
- `packages/agent-runtime/src/echo/protocol-summary.ts` — stale signing fix
- `agents/savant/system-prompt.ts` — prompt wording (secondary)
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts` +
  agent-runtime/CLI/SDK suites — test updates
- SDK single-agent sessions — unchanged: local-only, fail-closed (no
  embedded fallback)

#### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Core governance behavior (session-init grounding) is broken in the
  modes users actually use, and npm installs in arbitrary projects cannot boot;
  the fix touches protocol content, boot resolution, enforcement, and the run
  loop, so it must be designed and tested carefully.
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Enforce grounding at the **harness level**, deterministically, independent of
model behavior, mode, or installation. Six coordinated changes:

**Change 1 — Embedded harness grounding bundle (generated, drift-checked).**
New `scripts/generate-protocol-bundle.ts` reads the canonical repo files and
emits `common/src/constants/protocol-bundle.generated.ts` embedding the
**full** content of the **harness** grounding set (operator decision 5):
`ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml` (harness contract),
`dev/LEARNINGS.md`, and `templates/FID-TEMPLATE.md` — keyed to the harness
variant with the resolved contract (version, strictMode, protocolFile). The
single-agent document (`dev/echo-v0.1.2-single-agent.md`) is **explicitly
excluded** (operator correction): it is the protocol for outside agents
working on the repo, not the harness product, and does not ship with the
package. Repo history and artifacts (`dev/fids/` content, `session-summaries/`,
`nova/`, `test-prompts/`, `exports/`, `scratchpad/`, `releases/`) are also
excluded. The generator resolves all inputs relative to the repo root via
`import.meta.dir` (up-walk), never `process.cwd()`, so it is safe to run from
any workspace. The file is byte-stable and regenerated idempotently. A drift
check (e.g. `generate:protocol:check`, wired into `validate:repository` and
the pre-push path exactly like the provider-docs check) fails validation when
the generated file is stale, so grounding-set updates can never silently
diverge from what ships. This makes the product self-contained: every install
carries the full harness boot ritual.

**Change 2 — Local-first boot resolution with embedded fallback (harness-only).**
`resolveBootContract` keeps reading local files first (project-local
`protocol.config.yaml` + `ECHO.md` win — they can carry project-specific
overrides). When the harness files are absent or unreadable, it resolves the
contract from the embedded bundle instead of throwing. `protocolSource:
'local' | 'embedded'` is recorded on the main agent state at **both** boot
resolution call sites — `sdk/src/run-state/initial-state.ts:35-37` and
`sdk/src/run/execution/session-state.ts:104-110` (the latter re-validates on
resumed sessions), ideally via a shared helper. **Synthetic-read slot (named):**
the native `read_files` handler (`packages/agent-runtime/src/tools/handlers/list.ts:100`
`handleReadFiles` → `getFileReadingUpdates`) consults a small grounding-file
provider when `protocolSource === 'embedded'` and the requested path is a
harness grounding-set path, serving the bundled document; otherwise it falls
through to the normal filesystem path. This gives one enforcement path for
every mode — no seeding special case, no context injection, no pinned tokens,
nothing written to the user's cwd. **The single-agent variant is out of scope:**
it belongs to a third-party harness with different laws, the savant-code
harness never selects it, and this FID makes zero changes to it. The
fail-closed guarantee (FID-2026-0809-010) is preserved for genuinely missing
*bundle* content (build defect), not for absent user project files in harness
mode.

**Change 3 — Universal tool-level gate (`enforcement.ts`), armed by boot contract.**
Remove the `tier === 'all_15'` condition from the session-init gate so it fires
in every mode, local or embedded — the gate is never seeded for the main agent.
**Arming rule (Loop 4 backward-compat fix):** the gate is armed only when a
boot contract is resolved (`agentState.protocolFile` present, via a new
`gateArmed` option from the shared factory). SDK embedders who never set
`protocolVariant` get no boot contract → legacy behavior (no gate), so the
universal change cannot silently break non-ECHO SDK integrations; the CLI
always resolves, so product sessions (interactive, headless, SavantFree)
always gate. Pre-read allowed tools remain exactly as today (`read_files`,
`read_subtree`, `ask_user`, `write_todos`). Law 7/8/15 pre-write advisories
stay mode-tiered — this change only makes the Layer-1 boot gate universal when
armed. The gate clears on a read targeting the resolved protocol file
(normalized-path match); that read always succeeds because the read layer
resolves it from the local file or the embedded bundle. `protocolPreSeeded`
remains subagent-only (inheritance), so embedded sessions enforce grounding
exactly like local ones.

**Change 4 — Eager enforcement lifecycle (shared factory).**
Extract the `EchoEnforcement` construction in
`native.ts:247-259` into a shared `getOrCreateEnforcement(agentState)` helper
and call it at loop start for the main agent
(`loop.ts` before the loop, or `loop-iteration.ts` on iteration 1), so
`protocolRead` state exists from the very first step — before any tool call.
`native.ts` reuses the instance when present, so tool gating and loop gating
share one authoritative state object. Subagent pre-seeding is unchanged —
`protocolPreSeeded` is passed for subagents only (embedded sessions are NOT
seeded; they ground through the same read path as local sessions).

**Change 5 — First-turn completion gate (`loop-iteration.ts`).**
Runs for the main agent (`!parentId`) whenever `protocolRead === false` — both
after `runAgentStep` AND on the programmatic end-turn path (it must be placed
before the `if (!shouldContinue) return` that follows the programmatic-step
block, or a `handleSteps` main agent that ends its turn programmatically skips
grounding). It applies in **both** local and embedded modes — the embedded
protocol read resolves through the same read path, so the ritual is real in
every environment. If the step produced a text-only completion (no protocol
read), then:

- inject a bounded steering user message, mirroring the existing
  `ECHO_COMPLIANCE` steering at `loop-iteration.ts:333-358` exactly
  (`userMessage` + tags + `keepDuringTruncation: true`, no `userPrompt` TTL)
  stating the required boot reads;
- set `shouldEndTurn = false` so the loop continues and the model performs the
  reads (the steering runs before the output-schema restart branch, so a
  structured-output agent cannot have its "must use set_output" restart
  starved — grounding completes first);
- enforce a hard retry cap (e.g. 3) per session. **After the cap, disarm the
  completion gate for the entire session** with a one-time
  `compliance_warning`-style notice and allow the turn to proceed — otherwise
  a model that never reads would re-trigger up to 3 steering rounds on every
  subsequent user message (cost/UX). The tool-level gate (Change 3) remains
  armed.

Each steering retry consumes one `stepsRemaining` step and breaks the
prompt-cache prefix once — bounded by the cap, acceptable.

The 15-turn protocol refresh (`onStepBoundary`) then becomes meaningful in
hybrid mode too, because `protocolRead` can finally become true there.

**Change 6 — Prompt and refresh-content updates (includes purging the
hard-coded single-agent reference from the harness).**
Update the system-prompt Session-init paragraph
(`agents/savant/system-prompt.ts:115`) to describe the local-first + embedded
fallback flow and to state that the boot reads are the first action in every
mode. Fix the stale signing instruction in
`protocol-summary.ts:26-27` to the no-signature policy **and purge BOTH
hard-coded single-agent references from the harness's own injected context**:
(1) the `single-agent adaptation v0.1.2` mention in the governing-law line
(`protocol-summary.ts:26`), and (2) the `## Double audit (single agent)`
heading (`protocol-summary.ts:58`) — text lifted from the single-agent
document's "Double Audit (Single-Agent)" section, reworded to the harness's
own audit chain (Verifier AUDIT + Adversary meta-verification). By design the
harness has no single-agent concept, so its injected context (the 15-turn
refresh) must cite only the harness protocol (`ECHO.md` v0.2.0).
The harness product path is then audited to contain **zero** references to the
single-agent document: CLI entry points already hard-code
`protocolVariant: 'harness'` (`send-message-run-config.ts:189`,
`headless-run.ts:187`); the only harness-injected references are these two
refresh lines. The enforcement test fixture that uses
`dev/echo-v0.1.2-single-agent.md` as a protocol path (`enforcement.test.ts:163,167,181,185`)
is switched to `ECHO.md` so the harness test surface stops propagating the
name. (`buildSingleAgentDescription` in `templates/prompts.ts:118` and
`validateSingleAgent` in `agent-validation/validate.ts` are naming
collisions — they mean "one agent definition", not the single-agent protocol —
and are unchanged.) Extend the drift check with cheap substring-sync
assertions (key `ECHO.md` headings must appear in `protocol-summary.ts` and
`ECHO_PROTOCOL_INSTRUCTIONS`) so the condensed copies cannot silently drift;
full generation of the condensed copies from `ECHO.md` remains a follow-up
candidate so every embedded protocol copy shares one source of truth.

### Operator decision (test-blast-radius trade-off)

Change 3 (universal tool gate) makes the system prompt's "harness blocks other
tools" promise literally true in every mode, but it turns every fresh-fixture,
no-`parentId`, hybrid main-agent test that calls a non-read tool into a hard
failure (run-agent-step-tools-*, loop-agent-steps-*, echo-compliance-wiring,
headless-run, send-message suites). Change 5 alone already guarantees the
user-visible requirement — no ungrounded answer, reads steered as the first
action — with a fraction of the blast radius. **Operator decision (recorded):
implement all changes**, with a shared test fixture helper (clear the gate via
a protocol read or seed `protocolRead`) applied across the inventoried suites.

### Steps

1. Confirm operator approval to implement (this FID is planning-only).
2. Add `scripts/generate-protocol-bundle.ts` (inputs = the full grounding set,
   resolved via `import.meta.dir` up-walk) + the drift check wired into
   `validate:repository` and pre-push; generate
   `common/src/constants/protocol-bundle.generated.ts` and commit it.
3. `common/src/util/boot-contract.ts`: local-first resolution with embedded
   fallback (never throw on absent user files); add `protocolSource` to the
   resolved contract.
4. `sdk/src/run-state/initial-state.ts`: persist `protocolSource` on the main
   agent state; wire the read layer so protocol-file reads resolve from the
   bundle when the local file is absent (synthetic read — no context
   injection).
5. `enforcement.ts`: universal session-init gate (never seeded for the main
   agent); completion-gate state (cap counter + disarm flag).
6. Introduce `getOrCreateEnforcement` (shared factory); refactor `native.ts`;
   call it eagerly in `loop.ts` for the main agent.
7. `loop-iteration.ts`: first-turn completion gate with bounded steering +
   retry cap + session disarm, placed before the programmatic early-return.
8. `agents/savant/system-prompt.ts` + `protocol-summary.ts`: wording,
   stale-signing fix, and **purge of BOTH hard-coded single-agent references
   from the harness's own 15-turn refresh** (`protocol-summary.ts:26`
   governing-law line + `:58` "Double audit (single agent)" heading); switch
   the enforcement test fixture protocol path to `ECHO.md`.
9. Update `enforcement.test.ts` (flip line 197; hybrid gate coverage;
   completion-gate tests at the loop level); keep line 96 (Law 7) unchanged.
   Update boot-contract tests for the embedded fallback — the existing
   fail-closed fixtures in `common/src/util/__tests__/boot-contract.test.ts`
   that assert throws for absent files are inverted to assert embedded
   resolution; a build-defect fixture (bundle content missing) still throws.
10. Inventory and update affected suites (run-agent-step-tools-*,
    loop-agent-steps-*, echo-compliance-wiring, CLI headless/run-config,
    send-message) via a shared fixture helper that clears the gate with a
    protocol read or seeds `protocolRead`.
11. Verify SDK single-agent sessions resolve and gate on the single-agent
    protocol from local files only (fail-closed when absent; no embedded
    fallback — outside-agent protocol is not bundled).
12. Full validation: typecheck × relevant workspaces (agent-runtime, cli,
    common, sdk), targeted suites, root ESLint, markdownlint, Prettier,
    `validate:repository`, `generate:provider-docs:check`,
    `generate:protocol:check`.
13. Update docs (ECHO.md/ARCHITECTURE.md session-init section, LEARNINGS
    entry, CHANGELOG under 0.0.23).

### Verification

- Generation: `generate:protocol-bundle` is idempotent (byte-identical on
  re-run); `generate:protocol:check` fails when the generated file is stale
  (simulate by touching `ECHO.md`); substring-sync assertions catch condensed
  copy drift.
- Boot resolution: local files present → local contract wins; local files
  absent → embedded contract resolves without throwing; no files are
  scaffolded into the user's project.
- Embedded read: `read_files ECHO.md` / `ARCHITECTURE.md` /
  `protocol.config.yaml` / `dev/LEARNINGS.md` / `templates/FID-TEMPLATE.md`
  in embedded mode each return the full embedded document; the enforcement
  gate clears exactly as in local mode (no seeding); a text-only first answer
  is still steered by the completion gate.
- Unit: hybrid-mode enforcement blocks a non-read tool pre-read and allows
  `read_files` targeting the protocol file; the gate clears after the read.
- Unit: subagent-seeded instances skip the gate in hybrid (unchanged).
- Loop-level: a fresh main-agent text-only first step does not end the turn;
  steering is injected; the next step reads the protocol; the turn then ends
  normally. Retry cap test: after N non-compliant steps the gate disarms with
  the one-time notice.
- Regression: STRICT behavior unchanged (existing strict tests pass).
- Functional: a fresh CLI session answers `hello` only after observable boot
  reads (headless/print-mode run or tmux-cli run with tool visibility); a
  session booted in a directory without protocol files still completes.
- SDK single-agent boot-contract suites remain green (local-only resolution;
  harness embedded fallback does not apply to the single-agent variant).
- Harness boundary audit (corrected Loop 5 pattern):
  `grep -rniE 'single[ _-]?agent'` across harness-injected context —
  `packages/agent-runtime/src/echo/protocol-summary.ts`,
  `agents/savant/system-prompt.ts`, `agents/savant/prompts.ts`,
  `agents/thinker/thinker.ts`, `common/src/constants/agents.ts`
  (`ECHO_PROTOCOL_INSTRUCTIONS`), and the generated bundle — must return
  **zero matches**. Excluded from the gate (third-party bridge / historical
  records, not harness product): `common/src/util/boot-contract.ts`,
  `common/src/util/protocol-config.ts`, the `single_agent:` block in
  `protocol.config.yaml`, SDK/session single-agent resolution and its tests,
  and dated historical records such as `dev/LEARNINGS.md` session-summary
  references.
- Full gate: typecheck (agent-runtime, cli, common, sdk), test suites,
  ESLint `--max-warnings 0`, markdownlint, Prettier, `validate:repository`,
  provider-docs check, protocol-bundle drift check.

## Perfection Loop

### Loop 1 — RED

- **RED:** Two independent holes proven with file:line evidence: (A) the
  session-init gate is strict-only (`enforcement.ts:79` + mode mapping at
  `send-message-run-config.ts:185`), and (B) a text-only completion ends the
  turn with no grounding check (`step.ts:323-336` → `loop.ts:192`), while
  enforcement is created lazily only on the first tool call
  (`native.ts:247-259`). The operator-observed first-message answer confirms
  the ungrounded boot. The system prompt's "harness blocks other tools until
  you do" promise (`system-prompt.ts:115`) is therefore false in every
  non-strict mode and unenforced for text answers even in strict.
- **GREEN:** Proposed a three-part universal contract: (1) make the tool-level
  session-init gate fire in every mode; (2) create the enforcement instance
  eagerly at loop start via a shared factory so `protocolRead` exists before
  the first tool call; (3) add a bounded first-turn completion gate that
  blocks ungrounded text completions, injects corrective steering, and
  continues the loop with a retry cap + escape hatch. Subagent pre-seeding,
  strict-mode advisories, and SDK single-agent boot contracts are untouched.
- **AUDIT:** All evidence verified in-tree against the working tree. Existing
  hybrid no-op test (`enforcement.test.ts:197`) confirms the current behavior
  is deliberate and must be updated — no conflicting intent found in
  FID-2026-0806-005 or FID-2026-0809-010 that forbids universal grounding;
  the 0809-010 fail-closed boot contract is *strengthened* by this change.
  Line-number drift corrected during Loop 2 (see audit table below).
- **CHANGE DELTA:** Pure FID (planning document). No code written.

### Loop 2 — AUDIT (2026-08-10, independent review)

- **AUDIT METHOD 1 (static analysis):** Every file:line claim was grepped
  against the working tree. Content is correct in all cases; several line
  numbers drifted from the initial draft and were corrected:

  | Claim | Grep result |
  |---|---|
  | `getTier` maps strict→all_15 / other→core_4 | ✅ at `enforcement.ts:20-21` (was 13-16) |
  | Session-init gate `tier === 'all_15'` | ✅ `enforcement.ts:79` exact |
  | Gate clears via `isProtocolReadCall` | ✅ `enforcement.ts:80-83` |
  | Pre-read allowed tools | ✅ `enforcement.ts:326-331` (was 309-315) |
  | Lazy enforcement construction | ✅ `native.ts:247-259` (was 246-260) |
  | Non-STRICT → hybrid | ✅ `send-message-run-config.ts:185` exact |
  | Hybrid default | ✅ `create-run-config.ts:200` exact |
  | Text-only completion ends turn | ✅ `step.ts:323-336` (was 287-301); `shouldEndTurn` at 332 |
  | Loop break | ✅ `loop.ts:192` (was 100-132) |
  | Steering + 15-turn refresh | ✅ `loop-iteration.ts:333-358` and `:361-368` |
  | System-prompt promise | ✅ `system-prompt.ts:115` exact |
  | `protocolRead: false` | ✅ `enforcement-state.ts:27` exact |
  | Hybrid gate no-op test | ✅ `enforcement.test.ts:197` (was 155-162); line 96 is a *different* Law 7 steering no-op — must NOT change |
  | Harness boot contract | ✅ `send-message-run-config.ts:189`, `headless-run.ts:187` |

- **AUDIT METHOD 2 (adversarial review):** Independent review flagged and was
  resolved in this revision:
  1. **Cap semantics across turns (fixed):** the completion gate is now
     explicitly disarmed for the whole session after the retry cap, with a
     one-time notice — otherwise every subsequent user message would
     re-trigger up to 3 steering rounds.
  2. **Programmatic end-turn path (fixed):** the gate must run before the
     `if (!shouldContinue) return` after the programmatic-step block in
     `loop-iteration.ts`, or a `handleSteps` main agent that ends its turn
     programmatically skips grounding. Placement requirement is now explicit.
  3. **Structured-output interplay (documented):** the steering runs before the
     output-schema restart branch, so the "must use set_output" restart cannot
     be starved while ungrounded.
  4. **Steering message contract (documented):** mirror the `ECHO_COMPLIANCE`
     steering exactly — `userMessage` + tags + `keepDuringTruncation: true`,
     no `userPrompt` TTL; each retry costs one `stepsRemaining` step and one
     prompt-cache prefix break (bounded by the cap).
  5. **SDK single-agent wording corrected:** those sessions already run the
     gate (single-agent protocol is `strict_mode: true`), so the delta there
     is "unchanged", not "new gate applies".
  6. **Test blast radius surfaced as an operator decision:** the universal tool
     gate hard-fails every fresh-fixture hybrid main-agent suite that calls a
     non-read tool; Change 5 alone satisfies the user-visible requirement with
     less churn. Recommended: all changes + a shared fixture helper.

- **FIVE QUESTIONS (enforcement scope):**
  1. *Work for ALL cases?* — Yes: every mode, interactive/headless, SavantFree,
     and SDK sessions share the loop and the enforcement layer.
  2. *Scale to 1000 agents?* — Yes: one enforcement instance per main-agent
     run, created once at loop start; subagents stay pre-seeded.
  3. *Survive hostile actor?* — A model cannot emit an ungrounded answer
     (completion gate) and cannot use non-read tools before grounding
     (universal tool gate); the retry cap prevents wedge.
  4. *Maintainable in 2 years?* — The shared factory removes the
     native.ts/loop duplication risk; the gate remains one condition in
     `beforeToolCall` plus one bounded loop block.
  5. *Industry standard?* — Mandatory boot-time grounding before any
     completion is the same shape as fail-closed governance in agent
     frameworks; the bounded-steering retry is a standard corrective loop.

- **AUDIT VERDICT: PASS with corrections.** The three-change design was sound
  and all evidence content-correct. Loop 2 corrections (cap disarm,
  programmatic-path placement, line/test references, operator decision on
  blast radius) were folded in.

### Loop 3 — AUDIT of expanded scope (2026-08-10, operator decisions + packaging)

- **RED:** The operator surfaced the packaging reality: npm installs in
  arbitrary projects have no `ECHO.md`/`protocol.config.yaml`, and
  `resolveBootContract` fails closed on their absence
  (`boot-contract.ts:79-93` → `initial-state.ts:35-37`). Investigation
  confirmed only the condensed `ECHO_PROTOCOL_INSTRUCTIONS`
  (`constants/agents.ts:109`) is embedded, the full protocol document is not,
  and the hand-maintained condensed copies already drifted
  (`protocol-summary.ts:26-27` stale signing instruction).
- **GREEN:** Expanded to six changes: (1) generated embedded full-protocol
  bundle with a drift check; (2) local-first boot resolution with embedded
  fallback and `protocolSource` mode; (3) universal tool gate; (4) eager
  enforcement factory; (5) first-turn completion gate (cap + session disarm);
  (6) prompt + refresh-content fixes. Operator decisions recorded: local-first
  reads retained as the ritual, embedded fallback when absent (no crash, no
  scaffolding), generated-and-synced so the copies cannot drift, single FID
  scope, and the bundle carries the **harness grounding set** (`ECHO.md`,
  `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`,
  `templates/FID-TEMPLATE.md` — the single-agent doc is NOT bundled) so the
  entire session-init ritual resolves in any install — repo history/artifacts
  excluded.
- **AUDIT METHOD 1 (static analysis):** New claims verified in-tree:
  `boot-contract.ts:79-93` (fail-closed throw), `initial-state.ts:35-37`
  (unconditional resolve when variant set), `constants/agents.ts:109`
  (`ECHO_PROTOCOL_INSTRUCTIONS`), `prompts.ts:53,144,172,205` +
  `thinker.ts:95` (injection sites), `bundled-agents.generated.ts` (14
  embedded occurrences — ships with the CLI), `protocol-summary.ts:26` (stale
  signing line), `protocol.config.yaml` harness contract (v0.2.0 strict).
- **AUDIT METHOD 2 (adversarial checks):**
  1. **Does embedded mode weaken governance?** No — the full protocol content
     is injected into context (not just the condensed block) and the tool gate
     stays armed in local mode; embedded mode is grounded by construction with
     the complete document.
  2. **Does the drift check close the loop?** Yes — generation from the repo
     files + a stale-file check wired into validation means an `ECHO.md` edit
     without regeneration fails CI; this is the same proven pattern as the
     provider-docs and bundle checks.
  3. **Can embedded content itself go stale in the shipped package?** The
     generated module is committed and ships with each release; the drift check
     runs in-repo, and the release gate already requires a clean tree — the
     shipped copy is the verified copy.
  4. **Is fail-closed still preserved?** Yes for genuine build defects (missing
     bundle content throws an actionable error); absent *user project files*
     now fall back instead of crashing, which is the intended product behavior.
  5. **No scaffolding surprise?** The operator confirmed embedded fallback over
     writing files into the user's project; nothing is written to user cwd.

- **AUDIT METHOD 3 (adversarial review of the expanded design) — corrections
  folded in:**
  1. **Seeding flaw eliminated (design change).** The initial plan seeded
     `protocolRead: true` in embedded mode, which would have made the gates
     no-ops in exactly the environments that need them and recreated the
     observed bug (no ritual, no enforcement). Revised: the gate is **never
     seeded for the main agent**; embedded mode serves the protocol through
     the same read path (synthetic read), so one enforcement path covers every
     mode, the ritual is real everywhere, and `protocolPreSeeded` stays
     subagent-only. This also removes the pinned full-document token cost —
     the embedded document enters context through the normal read (subject to
     normal compaction, with the 15-turn refresh + condensed block as the
     long-term carriers), rather than a permanent `keepDuringTruncation`
     injection.
  2. **Generator path robustness.** All inputs resolve via `import.meta.dir`
     up-walk, never `process.cwd()`; the drift check slots into
     `validate:repository` and pre-push like the provider-docs check.
  3. **Single-agent bundle — superseded by operator correction (AUDIT METHOD
     4).** The initial draft embedded the resolved single-agent document
     directly per variant (no `ECHO-single-agent.md` marker indirection); the
     operator corrected this — the single-agent protocol is for outside agents
     working on the repo, is NOT shipped with the package, and keeps
     local-only, fail-closed resolution. The bundle now carries the harness
     grounding set only.
  4. **Boot-contract test fixtures.** `boot-contract.test.ts` fail-closed
     fixtures are inverted to embedded-resolution assertions (build-defect
     fixture still throws); named in Steps.
  5. **Condensed-copy sync.** The drift check adds substring-sync assertions
     (key `ECHO.md` headings must appear in `protocol-summary.ts` and
     `ECHO_PROTOCOL_INSTRUCTIONS`), closing the drift risk that already
     manifested (`protocol-summary.ts:26-27` stale signing).
- **FIVE QUESTIONS (packaging scope):**
  1. *Work for ALL cases?* — Repo, npm install, binary, and SDK sessions all
     resolve a contract (local or embedded).
  2. *Scale?* — One generated module; no per-project state beyond
     `protocolSource`.
  3. *Hostile actor?* — Embedded content is read-only build output; no network,
     no writes, no injection surface added.
  4. *Maintainable in 2 years?* — Single source of truth (repo files) with a
     mechanical generator + check; condensed copies are candidates for
     generation in a follow-up.
  5. *Industry standard?* — Vendoring canonical governance documents into the
     product with a sync gate is standard practice (e.g. license/branding
     bundles, generated SDK stubs).
- **AUDIT METHOD 4 (operator correction — single-agent not bundled):** the
  operator clarified that `dev/echo-v0.1.2-single-agent.md` is the protocol
  for **outside agents working on the repo**, not the harness product, and
  does not ship with the package. The bundle is therefore scoped to the
  **harness grounding set only**; the single-agent variant keeps its
  local-only, fail-closed resolution (FID-2026-0809-010) with no embedded
  fallback. All affected sections (Change 1, Change 2, Expected Behavior,
  Affected Components, Steps, Verification) were corrected accordingly.
- **AUDIT VERDICT: PASS with design corrections.** The expanded six-change
  design converges. Loop 3 corrections (synthetic-read over seeding, generator
  path robustness, direct single-agent embedding, inverted boot-contract test
  fixtures, condensed-copy substring assertions) are folded in. All operator
  decisions are recorded in the header. The FID is ready for final operator
  approval to implement.

### Loop 4 — AUDIT of the harness/single-agent boundary (2026-08-10, operator alarm)

- **RED:** The operator raised an alarm: the harness must have **no**
  "single-agent" system by design, and repeatedly referencing the term is
  alarming. A full-tree sweep was run for `single[-_]agent|singleAgent`,
  `echo-v0.1.2`, and `ECHO-single-agent` across cli/, common/, sdk/,
  packages/, and agents/.
- **GREEN:** Classified every match into harness-product vs third-party bridge:
  - 🔴 **One harness-injected hard-code found:** `protocol-summary.ts:26-27`
    — the 15-turn refresh the harness itself injects names "single-agent
    adaptation v0.1.2" as part of the governing law set. This is the leak.
    Purged by Change 6.
  - ✅ **CLI (product) is clean:** both entry points hard-code
    `protocolVariant: 'harness'` with comments citing the operator directive
    (`send-message-run-config.ts:187-189`, `headless-run.ts:183-186`);
    `create-run-config.ts:36` is a type union the CLI never uses for
    single-agent.
  - 🟡 **SDK/third-party bridge (kept, not harness):** the `single-agent`
    variant in `boot-contract.ts`/`protocol-config.ts` and the SDK/session
    resolution is the opt-in surface the operator's outside-agent workflow
    (third-party harness) uses; the savant-code product never selects it.
  - 🟡 **Cosmetic:** `enforcement.test.ts:163-185` uses the single-agent path
    as a fixture — switched to `ECHO.md`.
  - ✅ **Naming collisions, no change:** `buildSingleAgentDescription`
    (`templates/prompts.ts:118`) and `validateSingleAgent`
    (`agent-validation/validate.ts`) mean "one agent definition", not the
    single-agent protocol.
- **AUDIT VERDICT: PASS with corrections.** Change 6 now includes the purge;
  a verification gate asserts zero single-agent references in harness-injected
  context. The FID's own language was tightened so "single-agent" appears only
  when describing the third-party SDK bridge or the exclusion rule.

### Loop 5 — AUDIT of the harness-boundary sweep pattern (2026-08-10, adversarial)

- **RED:** Independent review flagged a sweep-pattern hole: Loop 4 grepped
  `single[-_]agent` / `single_agent` — which **misses the space-separated
  variant** `single agent` (and case variants). Re-sweep with
  `grep -rniE 'single[ _-]?agent'` confirmed the hole is real: the harness
  refresh contains a **second** hard-coded reference —
  `## Double audit (single agent)` at `protocol-summary.ts:58`, a heading
  lifted verbatim from the single-agent adaptation's
  "Double Audit (Single-Agent)" section. Both Loop 4's audit and the
  originally-proposed gate would have missed it.
- **GREEN (re-sweep results, pattern `single[ _-]?agent`, case-insensitive):**
  - 🔴 **Harness-injected context:** `protocol-summary.ts:26` and `:58` — the
    only two references. Both purged by Change 6.
  - ✅ **Clean:** `ECHO.md`, `ARCHITECTURE.md`, `agents/savant/system-prompt.ts`,
    `agents/savant/prompts.ts`, `agents/thinker/thinker.ts`,
    `common/src/constants/agents.ts` (`ECHO_PROTOCOL_INSTRUCTIONS`), and the
    generated bundle `cli/src/agents/bundled-agents.generated.ts` — zero
    matches.
  - 🟡 **SDK bridge / third-party config (kept):** the `single_agent:` block in
    `protocol.config.yaml:80-97` is the outside-agent contract config that
    the third-party harness reads; the savant-code product reads the
    `harness:` block. Not harness-injected context.
  - 🟡 **Historical records (kept):** `dev/LEARNINGS.md:33,120` reference dated
    single-agent session summaries (`2026-08-10-1144-single-agent-bootup-housekeeping.md`,
    `2026-08-09-1206-single-agent-init.md`). These are immutable dated
    history references, not governance instructions; the zero-reference gate
    applies to harness governance/injected context, not historical records.
  - 🟡 **Docs (decision recorded):** `README.md:22` and `CHANGELOG.md:13,15`
    describe the SDK's fail-closed single-agent boot contract — that is the
    third-party bridge feature documentation (FID-2026-0809-010), not the
    harness product path, and stays.
- **AUDIT VERDICT: PASS with corrections.** Loop 5 corrections folded in:
  Change 6 purges both refresh references; the verification gate below uses
  the corrected `single[ _-]?agent` pattern with the exact included/excluded
  path lists; docs and historical-record scope decisions are recorded.

### Missed Questions

1. **Should the completion gate live in `step.ts` or `loop-iteration.ts`?** →
   `loop-iteration.ts`. `step.ts` computes `shouldEndTurn` per step and is
   unit-tested in isolation; the gate needs the enforcement instance and the
   steering-injection pattern that already live in the loop layer. `step.ts`
   needs no change.
2. **Should a missing protocol file deadlock the gate?** → No. In local mode
   the gate clears on the read *call* matching the resolved protocol path,
   regardless of whether the file exists on disk; in embedded mode the same
   read call resolves from the bundle, so the gate clears identically.
   Confirmed by `isProtocolReadCall` semantics (`enforcement.ts:80-83`).
3. **Should the retry cap count per session or per first-turn?** → Per session,
   on the ungrounded-completion path only, and **the completion gate is
   disarmed for the rest of the session after the cap is hit** (one-time
   notice). A model that refuses to read must not wedge the session — and
   must not re-trigger steering rounds on every subsequent user message.
   (Loop 2 correction.)
4. **Should `protocolRead` be persisted so resumed sessions skip grounding?**
   → No. The user explicitly wants re-grounding on every session start; the
   in-memory state naturally resets on resume, which is the desired behavior.
5. **Does this change STRICT-mode behavior?** → No. Strict already enforces the
   tool gate; the completion gate adds the missing text-answer coverage there
   too, which is the fix, not a regression.
6. **Is `run_readonly_command` pre-read allowed?** → Keep current strict
   semantics (blocked pre-read) for consistency; not part of this FID's scope
   to loosen.
7. **What is the test blast radius?** → `enforcement.test.ts` (1 changed
   assertion at line 197 + new hybrid coverage; the Law 7 steering no-op at
   line 96 stays) and any agent-runtime/CLI suite that runs tools against a
   fresh main-agent fixture in hybrid. Inventory during implementation;
   fixtures either clear the gate with a protocol read or assert the new
   blocked/steered behavior. Presented as an explicit operator decision
   (universal tool gate vs completion-gate-only).
8. **Should the boot contract scaffold missing files into the user's project?**
   → No (operator decision): embedded fallback loads the full content
   internally; nothing is written to the user's cwd.
9. **Should the condensed `ECHO_PROTOCOL_INSTRUCTIONS` and the 15-turn refresh
   summary also be generated?** → Follow-up candidate. The full-protocol bundle
   closes the primary drift risk; converting the condensed copies to generated
   output is noted in Change 6 as future work so they share the same source of
   truth.
10. **Is a GitHub-release fetch part of this FID?** → No. Embedded content is
    version-matched to the installed release and requires no network; a remote
    refresh layer can be considered separately if ever needed.
11. **Why synthetic reads instead of injecting the full document into the
    first-turn context?** → Injection with `keepDuringTruncation: true` would
    pin the full document in context for the whole session (defeating
    compaction) and triple-count the protocol (condensed block + full doc +
    15-turn refresh). Routing the embedded document through the normal read
    path preserves the ritual, keeps one enforcement path, and lets normal
    compaction manage context, with the refresh + condensed block as the
    long-term carriers.
12. **Should the gate be seeded in embedded mode?** → No (Loop 3 design
    change). Seeding would disable the gates exactly where npm-install
    enforcement matters most and recreate the observed ungrounded-boot bug.
    `protocolPreSeeded` remains subagent-only.
13. **Should the full `dev/` tree be embedded or scaffolded?** → No (operator
    decision 5). Only the harness grounding set is embedded — the rest of
    `dev/` (`fids/` content, `session-summaries/`, `nova/`, `test-prompts/`,
    `exports/` 14 MB, `scratchpad/` 41 MB, `releases/`) is repo history or
    artifacts. Materializing a `dev/` scaffold in user projects remains a
    separate opt-in "adopt ECHO governance" feature, not part of this FID.
14. **Should the single-agent protocol document be bundled?** → No (operator
    correction). `dev/echo-v0.1.2-single-agent.md` is the protocol for outside
    agents working on the repo, not the harness product; it does not ship
    with the package. The bundle carries the harness grounding set only, and
    the single-agent variant keeps local-only, fail-closed resolution.
15. **Does the harness hard-code the single-agent document anywhere?** → Two
    places, found by the Loop 4 sweep + Loop 5 pattern re-sweep:
    `protocol-summary.ts:26` ("single-agent adaptation v0.1.2" in the
    governing-law line) and `protocol-summary.ts:58` ("## Double audit
    (single agent)" heading). Change 6 purges both, so the harness product
    path contains **zero** references to the single-agent protocol. The SDK
    `single-agent` variant (`boot-contract.ts`/`protocol-config.ts`) is the
    third-party bridge for outside agents and stays; the savant-code product
    never selects it.

### Code Verification Evidence

- [x] `enforcement.ts:20-21,79` — tier-gated session-init gate confirmed
- [x] `native.ts:247-259` — lazy enforcement construction confirmed
- [x] `send-message-run-config.ts:185` — non-STRICT → hybrid confirmed
- [x] `create-run-config.ts:200` — hybrid default confirmed
- [x] `step.ts:323-336` — text-only completion ends turn, no grounding check
- [x] `loop.ts:192` — loop break on `shouldEndTurn`
- [x] `loop-iteration.ts:333-358,361-368` — steering + refresh blocks
- [x] `system-prompt.ts:115` — unfulfilled enforcement promise confirmed
- [x] `enforcement-state.ts:27` — `protocolRead: false` initial state
- [x] `enforcement.test.ts:197` — hybrid gate no-op confirmed (line 96 is the
  Law 7 steering no-op — stays strict-only)
- [x] `send-message-run-config.ts:189` + `headless-run.ts:187` — harness boot
  contract confirmed
- [x] `boot-contract.ts:79-93` — fail-closed throw on absent files confirmed
- [x] `initial-state.ts:35-37` — unconditional resolve when variant set
- [x] `constants/agents.ts:109` + `prompts.ts:53,144,172,205` +
  `thinker.ts:95` — `ECHO_PROTOCOL_INSTRUCTIONS` injection confirmed
- [x] `bundled-agents.generated.ts` — 14 embedded protocol occurrences ship
  with the CLI bundle
- [x] `protocol-summary.ts:26-27` — stale signing instruction confirmed
- [x] Implementation — complete 2026-08-10 (all six changes verified green)

## Resolution

- **Status:** closed (implemented 2026-08-10 under operator automation level 3)
- **Implementation:** All six changes shipped and verified end to end (see the
  implementation summary below).
- **Fixed Date:** 2026-08-10
- **Tests Added:** Yes — universal-gate unit tests, completion-gate unit
  tests (block/clear/disarm/legacy), embedded-fallback boot-contract tests,
  embedded-provider unit tests, loop-level completion-gate tests (steered
  text-only first turn + protocol-read clears the gate), scripts validation
  manifest coverage.
- **Verified By:** typecheck × 4 (sdk, common, agent-runtime, cli); full suites
  green — agent-runtime 769, common 563, sdk 460, cli 2,938, scripts 21;
  ESLint `--max-warnings 0`; markdownlint; Prettier; `validate:repository`
  PASS; `generate:protocol-bundle:check` + `generate:provider-docs:check`
  clean; harness-boundary sweep (`single[ _-]?agent`) zero matches in
  harness-injected context.
- **Archived:** 2026-08-10 (moved to `dev/fids/archive/`)
- **Related:** Extends FID-2026-0806-005 (session-init gate) to all modes;
  complements FID-2026-0809-010 (boot contract selection) and the harness
  boot-contract fix applied earlier this session.

### Implementation Summary (2026-08-10, operator automation level 3)

1. **Change 1 — Embedded harness grounding bundle:**
   `scripts/generate-protocol-bundle.ts` (new) emits
   `common/src/constants/protocol-bundle.generated.ts` embedding the full
   harness grounding set (`ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`,
   `dev/LEARNINGS.md`, `templates/FID-TEMPLATE.md`), keyed to the harness
   variant. Single-agent document deliberately NOT bundled. Drift check wired
   into `validate:repository`, the root `generate:protocol-bundle:check`
   script, and the pre-push hook. Generator formats with the repo `.prettierrc`
   (byte-identical to the format gate) and is idempotent.
2. **Change 2 — Local-first boot resolution with embedded fallback:**
   `resolveBootContract` keeps local files winning; harness mode falls back to
   the embedded bundle instead of throwing when files are absent (npm install
   case). `protocolSource: 'local' | 'embedded'` persisted on main agent state
   at both SDK boot-resolution call sites (`initial-state.ts`,
   `session-state.ts`). Single-agent variant unchanged (local-only, fail
   closed). Synthetic read via `embedded-protocol.ts` + the native
   `read_files` handler serves grounding-set paths from the bundle in embedded
   mode; everything else reads from the filesystem.
3. **Change 3 — Universal tool-level gate:** the session-init gate in
   `EchoEnforcement.beforeToolCall` no longer requires `tier === 'all_15'` —
   it fires in every mode when armed. Arming follows the boot contract
   (`gateArmed: Boolean(agentState.protocolFile)`); SDK embedders without a
   protocol variant keep legacy no-gate behavior. Gate is never seeded for the
   main agent; `protocolPreSeeded` stays subagent-only.
4. **Change 4 — Eager enforcement lifecycle:** shared
   `getOrCreateEnforcement(agentState)` factory; called eagerly at loop start
   for the main agent (`loop.ts`); `native.ts` reuses the instance. Tool gating
   and loop gating share one authoritative state.
5. **Change 5 — First-turn completion gate:** `applyUngroundedCompletionGate`
   in `loop-iteration.ts` runs on the LLM end-turn path AND the programmatic
   end-turn path (before the early return). Ungrounded text-only completions
   are steered with `ECHO_COMPLIANCE` messaging and the loop continues;
   `COMPLETION_GATE_MAX_RETRIES = 3`, after which the completion gate disarms
   for the session with a one-time notice (tool gate stays armed). Subagents
   exempt.
6. **Change 6 — Prompt/refresh fixes:** both hard-coded single-agent
   references purged from `protocol-summary.ts` (`:26` governing-law line and
   `:58` "Double audit (single agent)" heading); stale "Sign as Savant only"
   policy fixed to no-signature; `agents/savant/system-prompt.ts` session-init
   paragraph rewritten (local-first + embedded fallback, universal);
   enforcement test fixture paths switched to `ECHO.md`; drift check asserts
   key ECHO.md headings survive in the condensed copies.

Harness boundary after implementation: `grep -rniE 'single[ _-]?agent'` over
`protocol-summary.ts`, `system-prompt.ts`, `prompts.ts`, `thinker.ts`,
`constants/agents.ts`, and the generated bundles returns zero matches in
harness-injected context.

## Lessons Learned

A governance promise in a system prompt is only as strong as the enforcement
behind it. Two silent holes — a mode-gated gate and a tool-only gate — allowed
the boot reads to be skipped entirely. Any "harness blocks X until Y"
instruction must be backed by enforcement at the completion level, not just the
tool level, and must be universal across modes. And a boot contract that
requires repository files in the user's project directory cannot ship as an
npm package: the protocol must be vendored into the product (generated from the
canonical repo files, drift-checked) so every installation is grounded by
construction, with local files as the project-specific override.

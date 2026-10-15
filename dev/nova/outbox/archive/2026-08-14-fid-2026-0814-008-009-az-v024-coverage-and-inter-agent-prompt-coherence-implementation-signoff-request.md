<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0814-008 / -009 (A–Z 0.0.24 Coverage Extension + Inter-Agent Prompt Coherence Audit)

**Date:** 2026-08-14
**Scope:** Implementation of two follow-on records — the `az-v0.0.24-harness-live-test.md` `5e` coverage extension (008) and the project-wide inter-agent prompt & definition coherence audit (009).
**Status:** REQUESTED
**Priority:** Medium (008 test-prompt documentation) / High (009 P0 basher prompt contradiction + P1 privacy-flag preservation + P1 model-surface cleanup)

## Request

Please independently audit the implemented FIDs below and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation sign-off request**. A PASS verifies the implementation; it does **not** authorize closure, archive movement, commit, push, release, publication, or deployment. Operator closure is a separate decision.

## Records under review

Both records live in `dev/fids/archive/` with status `closed` (working-tree closure evidence):

- `dev/fids/archive/FID-2026-0814-008-az-v024-live-test-002-007-coverage.md`
- `dev/fids/archive/FID-2026-0814-009-inter-agent-prompt-coherence-audit.md`

## What was implemented

### FID-008 — A–Z 0.0.24 coverage extension (test-prompt documentation only)

- `dev/test-prompts/az-v0.0.24-harness-live-test.md` (→ v1.2.0): new `5e` phase with 18 rows (V024-150…167) — 9 executable suites + 9 static greps — covering FID-2026-0814-002..007 (goal engine, hook system, harness frictions + model unification, Trust Matrix `no_verdict`, compaction feedback); two Phase 3 operator live rows (`/goal` lifecycle, in-stream `CompactionSignal`); three Agent View re-examination items; target paragraph extended to name `FID-2026-0814-002..007`.
- No product code, no new config, no new store, no new test harness. All rows point at suites/greps already present on disk.

### FID-009 — Inter-agent prompt & definition coherence audit (B-01…B-06)

- **B-01 (P0, basher)** — `agents/basher.ts`: `instructionsPrompt` rewritten to the true two-phase contract ("the command has already been executed and its output is in context; summarize and call no tools"), removing the "run the command" vs "Do not use any tools" contradiction. The deterministic `handleSteps` generator already runs `run_terminal_command` before the LLM takes over.
- **B-02** — `agents/detective/detective.ts`: "Forge's RED phase responsibility" → "Forge's role (GREEN phase)".
- **B-03** — `agents/recorder/recorder.ts`: status vocabulary aligned to `created | analyzed | fixed | verified | closed`.
- **B-04** — `agents/scout/scout.ts`: stale XML-tag `set_output` instruction removed.
- **B-05** — `agents/thinker/thinker-gpt.ts` deleted; `/plan` + `/review` fold into the standard `@thinker` (spawnable at `agents/savant/savant.ts:177`; the old `@thinker-gpt` was never in the allowlist, so the delegation was dead). `cli/src/commands/prompt-builders.ts` + test, `savant-free/SPEC.md`, `dev/quality-baseline.json` updated. The ChatGPT-OAuth connection feature itself is untouched.
- **B-06** — `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` `withParentModel`: child's `providerOptions` (e.g. `data_collection: 'deny'`) now overlays the parent's instead of being replaced, preserving the infra helpers' privacy flag when the default savant spawns them.

## Verification evidence (reproduce independently)

- **Typecheck ×4** — `sdk`, `common`, `packages/agent-runtime`, `cli` — all exit 0.
- **Full root suites (Bun 1.3.14):**
  - `sdk` — 476 pass / 1 skip / 0 fail
  - `common` — 614 pass / 4 skip / 0 fail
  - `packages/agent-runtime` — 960 pass / 0 fail
  - `cli` — 3088 pass / 18 skip / 0 fail
  - `agents` — 49 pass / 0 fail
- **Focused assertions added:** two `withParentModel` assertions in `packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts` (B-06); `cli/src/commands/__tests__/prompt-builders.test.ts` updated for the `@thinker` fold (B-05).
- **ESLint** `bun x eslint . --max-warnings 0` — zero warnings. **lint:md** — 0. **Prettier** — clean.
- **`bun run validate:repository`** — PASS. **fid-ledger** — clean.

## Hard questions Nova must verify at source

1. **Basher prompt contradiction is gone (B-01).** Confirm `agents/basher.ts` no longer contains "Run the command and then describe" alongside "Do not use any tools"; confirm the two-phase contract text is present and `handleSteps` still yields `run_terminal_command` before yielding `'STEP'` under `what_to_summarize`. `grep -n "already been executed\|Do not call any tools" agents/basher.ts`.
2. **Forge phase attribution corrected (B-02).** `grep -n "GREEN" agents/detective/detective.ts` shows Forge is GREEN; no remaining "Forge's RED phase".
3. **Recorder vocabulary aligned (B-03).** `grep -n "created\|analyzed\|fixed\|verified\|closed" agents/recorder/recorder.ts`; no remaining `in_progress, complete, closed`.
4. **Scout stale instruction removed (B-04).** `grep -n "set_output tool by calling it as a function\|XML tags" agents/scout/scout.ts` → no match.
5. **thinker-gpt fold is clean and the paid hardcode is gone (B-05).** `ls agents/thinker/` → no `thinker-gpt.ts`; `grep -rn "thinker-gpt" agents/ cli/src/commands/prompt-builders.ts` → no live reference (only removal-reference prose); `grep -rn "openai/gpt-5.4" agents/` → no match; `grep -n "'thinker'" agents/savant/savant.ts` shows `@thinker` is spawnable; ChatGPT-OAuth surface (`cli/src/utils/chatgpt-oauth.ts`) is unchanged.
6. **withParentModel preserves the child privacy flag (B-06).** Confirm `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` merges `providerOptions` so a child's `data_collection: 'deny'` survives when the default savant spawns it; confirm the four helpers still declare `data_collection: 'deny'` (`agents/tmux-cli.ts`, `agents/browser-use/browser-use.ts`, `agents/database/database.ts`, `agents/github/github.ts`); confirm the flat spread `{ ...parent.providerOptions, ...child.providerOptions }` typechecks against `OpenRouterProviderRoutingOptions`.
7. **FID-008 rows point at real suites/sites.** `grep -n "V024-15[0-9]\|V024-16[0-7]" dev/test-prompts/az-v0.0.24-harness-live-test.md` and spot-check that each referenced suite exists on disk (e.g. `goal-engine.test.ts`, `goal-tools.test.ts`, `goal-driver.test.ts`, `hooks/{runner,engine}.test.ts`, `context-compactor-micro.test.ts`, `savant-free-model-store.test.ts`, `chat-store-compaction.test.ts`, `context-pruner-phase3.test.ts`, `provenance.test.ts`, `run-readonly-command.test.ts`, `sdk/src/run/execution/__tests__/snapshot.test.ts`).
8. **No ECHO law weakened / no new authority.** The prompt edit (008) adds no code; the coherence fixes (009) change prompt text/metadata and one `providerOptions` merge; no new tool, no new write path, no new store, no new authority.

## Residual observation (out of scope — flagged, not actioned)

During the final gate sweep a paid-model hardcode surface was discovered in the
best-of-n editor subsystem (`agents/editor/best-of-n/*`: `editor-multi-prompt.ts:16`
`anthropic/claude-opus-4.8`, `editor-implementor.ts`/`best-of-n-selector2.ts`
default to `claude-opus-4.8` with `gpt-5`/`sonnet` options mapping to paid
models). These `SecretAgentDefinition`s are NOT in the main savant's
`spawnableAgents` and were outside FID-009's B-01..B-06 scope, so they were
**not** modified. They are documented in the FID-009 residual-finding section
for a separate operator decision (reconcile to `resolveActiveModel()` vs.
record an explicit multi-model exception). Nova is asked to note, not adjudicate,
this observation.

## Authorization boundary

This request authorizes no closure, archive movement, commit, push, release, publication, or deployment. Operator closure follows a Nova PASS plus the operator's explicit approval. The FIDs are already physically in `dev/fids/archive/` as working-tree closure evidence; a Nova FAIL would require the records be pulled back to `dev/fids/` and self-corrected.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim (including any count drift, e.g. the exact test totals above).
4. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.

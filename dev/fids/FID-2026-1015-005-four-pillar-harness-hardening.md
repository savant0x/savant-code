# FID: Four-pillar harness hardening — vacuous-verifier guard, evidence recovery, skill diff, and subagent write-scope

**Filename:** `FID-2026-1015-005-four-pillar-harness-hardening.md`
**ID:** FID-2026-1015-005
**Severity:** high
**Status:** converged
**Created:** 2026-10-15 21:45
**Automation level:** 3
**Depends On:** none
**Master FID:** FID-2026-1012-022
**YAGNI-Compliance:** Verified

---

## Summary

This FID specifies and converges four high-leverage harness capabilities across `@savant-code/agent-runtime`,
`@savant-code/common`, and `@savant-code/cli`, grounded in live call-graph inspection (eliminating items from earlier
reviews that already landed in `FID-2026-0912-001`, `FID-2026-0912-004`, and `FID-2026-1005-003`):

1. **Pillar 1 — Vacuous-Verifier Detection & Settled-State Loop Breaker (EHEL Law 3):** Refuse Law 3 verification credit
   when a test/verify command exits `0` but executed zero tests (`0 pass`, `No tests found`, `collected 0 items`,
   `[no test files]`), and prevent repeated identical read-only/verification checks when the worktree state has not
   changed (`worktreeStateEpoch` settled-state fingerprint).
2. **Pillar 2 — On-Demand Evidence Recovery Tool (`LF-004`, `recover_evidence`):** Close the `.savant/evidence/` spill
   loop for the Orchestrator, Researcher, Detective, and Scout by exposing a read-only native tool backed by the
   existing `resolveRetainedPayload()` and `loadEvidenceRecords()` primitives in
   `packages/agent-runtime/src/evidence/spill-read.ts` — zero new storage engines.
3. **Pillar 3 — Unified LCS Skill Diff & `create` Baseline-Pin Hardening:** Replace the naive index-aligned `diffLines`
   in `cli/src/commands/skills-discovery.ts` with a real LCS unified diff (`[-N/+M]` hunk header + context lines),
   surface a one-line diff summary on default `/skills show <name>` when both live and quarantine copies exist, and pin
   `createSkill` drafts with `baselineSha: "none"` so `/skills trust` refuses if a live skill was created concurrently
   after the draft was authored.
4. **Pillar 4 — Per-Subagent `writeScope` Clamp, Subagent Report Sanitizer, & Pure Orchestration PresetStepper:**
   Enforce an optional `writeScope?: string[]` glob list on `spawn_agents` as a monotone clamp (`child ⊆ parent ⊆
   SCOPE.md`) inside EHEL Law 2, sanitize subagent output before it re-enters parent context (neutralizing forged
   harness XML tags and prompt-injection override phrases with auditable metadata), and add a pure, clock-injected
   `advancePresetStep()` state-machine stepper over `PresetShape` in `common/src/util/orchestration-preset.ts`.

## Environment

- **OS:** Windows 11 (win32), Git Bash; portable TypeScript/Bun
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122, `zod` 4.2.1
- **Commit/State:** `main` @ `v0.0.36` development line; implementation present, final gates running.

## Detailed Description

### Problem

#### Pillar 1 — Vacuous verification passes and settled-state verification loops

1. `packages/agent-runtime/src/util/echo-compliance-core.ts:4-5` (`VERIFICATION_COMMAND_PATTERN`) classifies a command
   string as a verification run by regex, and
   `packages/agent-runtime/src/echo/enforcement/verification-credit.ts:53-59` grants Law 3 credit to all `dirtyFiles`
   whenever `commandSucceeded === true`.
2. In `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:187`, `commandSucceeded` is computed as
   `!hasCommandFailure(toolResult.content)`, which inspects `exitCode !== 0` in
   `packages/agent-runtime/src/tools/tool-executor/tool-result-inspection.ts:174-188`.
3. When a test runner exits `0` while matching zero tests (e.g., `pytest` exit 0/5 with `collected 0 items`, `go test`
   printing `[no test files]`, `npm test -- --grep nonexistent` printing `0 passing`, or a shell pipeline without
   `pipefail` masking a non-zero test exit), `creditVerificationRun` marks all dirty files verified and clears
   `failureAttributedFiles`.
4. Separately, `packages/agent-runtime/src/echo/enforcement/escalation.ts:28-31` escalates repeated *blocked writes*
   (`N=3`), but nothing tracks repeated *read-only verification or search calls* against an unchanged worktree. An agent
   can run the same passing `run_readonly_command` or 0-match `code_search` across consecutive turns while `writeCount`
   has not advanced, burning tokens to re-prove a settled fact
   (`dev/idea-shelf/bcbc-verification-loop-lesson-2026-10.md`).

#### Pillar 2 — Retained spill evidence is unreachable on demand by non-audit agents (`LF-004`)

1. `packages/agent-runtime/src/evidence/spill.ts:62` (`retainOriginal`) writes raw (redacted) tool outputs to
   `.savant/evidence/<runId>.jsonl` and returns a `RetentionHandle` (`file`, `toolCallId`, `sha256`, `bytes`,
   `redacted`).
2. `packages/agent-runtime/src/util/omission-marker.ts:25-39` (`OmissionMarker`) embeds that `RetentionHandle` into the
   model-facing `{ omitted: { retained: { ok: true, file, toolCallId, sha256, bytes, redacted } } }` stub whenever
   `simplify-tool-results.ts` or `trimming.ts` compacts a large tool output.
3. `packages/agent-runtime/src/evidence/spill-read.ts:138-155` (`resolveRetainedPayload`) already implements
   fail-closed SHA-256-verified retrieval of any `RetentionHandle`, and `loadEvidenceRecords` (`spill-read.ts:64-116`)
   loads a run's shards with an mtime+size cache.
4. Yet the only production callers of `spill-read.ts` are `spawn-evidence.ts` and unit tests. Neither the Orchestrator
   nor the Researcher, Detective, or Scout has a tool to resolve a `toolCallId` from `.savant/evidence/` on demand after
   compaction or omission (`dev/feature-pipeline/report.md:54-68`, `LF-004`). Furthermore, `.savant/evidence/*.jsonl`
   holds multi-megabyte JSONL lines where each line wraps `raw` inside JSON, making direct `read_files` on the shard
   fragile and unindexed by `toolCallId`.

#### Pillar 3 — Index-aligned skill diff distortion and unpinned `create` race on `/skills`

1. Ground-truth verification against the live tree confirms that several items from `docs/design/SkillOpt Integration
   into Savant.md` are **already implemented**:
   - `common/src/util/skill-management/baseline-sha.ts:44-63` (`pinDraft`) injects `metadata.baselineSha` on `patch`
     and `edit`, and `common/src/util/skill-management/trust.ts:127-143` refuses `/skills trust` on mismatch.
   - `cli/src/commands/skills.ts:68-75` already prints a state-gated pointer when quarantined drafts exist.
   - `common/src/util/skill-proposals.ts:103-138` (`buildDraftingPrompt`) and `scripts/lessons-to-skills.ts:23-29`
     already implement the isolated proposer handoff.
2. However, **three concrete gaps remain** in the live code:
   - **Broken index-aligned diff:** `cli/src/commands/skills-discovery.ts:242-254` (`diffLines`) compares
     `liveLines[i] === draftLines[i]` by array index! Inserting a single line at line 2 of a 50-line `SKILL.md` causes
     every subsequent line (`i = 2..50`) to mismatch, emitting 96 false `-`/`+` lines capped at 60 lines and rendering
     the diff unreadable.
   - **Silent draft divergence on `/skills show <name>`:**
     `cli/src/commands/skills-discovery.ts:134-174` (`showMessage`) renders only `live ? 'trusted' : 'quarantined draft'`
     — when *both* a trusted live skill and a pending quarantined patch exist for `<name>`, `/skills show <name>` hides
     the existence of the pending draft and its `[-N/+M]` line delta unless the operator remembers to pass `--review`.
   - **`createSkill` unpinned TOCTOU race:** `common/src/util/skill-management/mutations.ts:40-96` (`createSkill`) does
     not stamp `metadata.baselineSha` because `live` does not exist at creation time. In `trust.ts:129-131`,
     `baselineSha === null` falls through as a "legacy unpinned draft" and overwrites `liveDir` (`trust.ts:146`) if a
     live skill of the same name was created or trusted in the interim.

#### Pillar 4 — Missing subagent write-scope narrowing, raw output relay, and unexecutable presets

1. **Per-subagent write-scope narrowing:** `packages/agent-runtime/src/echo/pre-write-gates-law2.ts:115-137`
   (`runLaw2Gate`) checks write targets only against the repository-wide `SCOPE.md` target union. When the Orchestrator
   spawns parallel `forge` subagents via `spawn_agents`
   (`packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`), there is no way to narrow a specific child's
   write authority to a subset of globs (e.g. `packages/code-map/**` for Worker A and `packages/database/**` for
   Worker B). Any child can overwrite another child's files as long as both globs appear in `SCOPE.md`.
2. **Unsanitized subagent output relay:** `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:133-137` and
   `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts:255-265` relay child output directly into the
   parent's tool result without inspecting or neutralizing forged harness XML tags (`<system>`, `<user>`,
   `<compaction-notice>`, `<evidence-restored>`, `<skill_instructions>`) or prompt-injection override directives fetched
   by research/scout subagents from untrusted external content.
3. **Validation-only orchestration preset:** `common/src/util/orchestration-preset.ts:27-33` validates `PresetShape`
   from `protocol.config.yaml`, but provides no pure state-machine stepper (`advancePresetStep`) to compute the next
   activated role(s), terminal completion state, or dead-end error from `(preset, currentRole, publishedEvent,
   history)` under the repository's pure-decision convention
   (`packages/agent-runtime/src/__tests__/pure-decision-convention.test.ts`).

### Expected Behavior

1. **Pillar 1:**
   - A verification command (`detectsVerificationCommand(cmd) === true`) whose output matches a vacuous execution
     signature (`0 pass` with `0 fail`, `No tests found`, `collected 0 items`, `[no test files]`, `0 specs, 0 failures`)
     is classified as `vacuous: true` with a concrete `vacuousReason`.
   - `creditVerificationRun` refuses Law 3 verification credit on a vacuous pass, keeps `dirtyFiles` unverified, emits a
     Law 3 advisory warning naming the vacuous reason, and records a `flagged` compliance-telemetry event at the
     `receipt` layer.
   - `EnforcementState` tracks a settled-state map `settledChecks: Map<string, { writeCount: number; summary: string }>`
     keyed by `(toolName, normalizedInputKey)` for read-only verification and search tools (`run_readonly_command`,
     `code_search`, `glob`). When the identical check is invoked **3 consecutive times** while `state.writeCount` is
     unchanged, `beforeToolCallImpl` emits a corrective Law 3 steering warning (`"Bridge crossed: worktree state
     (writeCount=N) is unchanged since this exact check last ran..."`) and blocks on the 3rd identical unchanged check.
     Any write or mutating command (`state.writeCount` increment) or `resetForNewTurn` clears stale blocks as
     appropriate.
2. **Pillar 2:**
   - A new read-only native tool `recover_evidence` is registered in `common/src/tools/constants.ts`,
     `common/src/tools/list.ts`, and `packages/agent-runtime/src/tools/handlers/list.ts`, and added to the `toolNames`
     of `savant` (Orchestrator), `researcher`, `detective`, and `scout`.
   - `recover_evidence` accepts `{ toolCallId: string; offset?: number; limit?: number; query?: string }`.
   - It looks up the record across the current run's `.savant/evidence/<runId>.jsonl` shards (via `loadEvidenceRecords`
     + `resolveRetainedPayload` / SHA-256 verification), optionally filters lines matching `query` (case-insensitive
     substring or safe literal match) and slices by character `offset`/`limit` (default `limit: 16000`, max `32000`),
     returning `{ found: boolean; toolCallId: string; toolName?: string; sha256Verified?: boolean; redacted?: boolean;
     totalChars?: number; offset?: number; content?: string; reason?: string }`.
3. **Pillar 3:**
   - `diffLines(live, draft)` in `cli/src/commands/skills-discovery.ts` uses a deterministic Longest Common Subsequence
     (LCS) line diff that emits a `[-removed/+added]` summary header and unified diff hunks (`@@ ... @@` with 2 lines
     of context), bounded at 80 output lines.
   - `showMessage(projectRoot, name)` in `cli/src/commands/skills-discovery.ts` detects when *both* `live` and `draft`
     exist for `name` and appends a prominent notice:
     `⚠ Pending quarantined draft v<draft.version> ([-N/+M] lines vs live) — run /skills show <name> --review`
   - `createSkill` in `common/src/util/skill-management/mutations.ts` stamps `metadata.baselineSha: 'none'` (via
     `withBaselineSha(built.content, 'none')`), and `trustSkill` in `common/src/util/skill-management/trust.ts` refuses
     with a `Drift detected` error if `baselineSha === 'none'` and `currentLiveSha !== null` (a live skill was created
     after the `create` draft was authored).
4. **Pillar 4:**
   - `spawn_agents` input schema (`common/src/tools/params/tool/spawn-agents.ts`) accepts an optional
     `writeScope?: string[]` per spawned agent entry (or inside `params.writeScope`).
   - `AgentState` (`common/src/types/session-state.ts`) and `EnforcementState`
     (`packages/agent-runtime/src/echo/types.ts`) carry `allowedWriteGlobs?: string[]` (classified in `CHILD_OWN` in
     `spawn-child-fields.ts` and narrowed by the clamp rule: when a parent has `allowedWriteGlobs`, the child's
     effective `allowedWriteGlobs` is enforced as both parent globs and child globs — every write target must match the
     parent's globs AND the child's globs AND `SCOPE.md`).
   - `runLaw2Gate` in `packages/agent-runtime/src/echo/pre-write-gates-law2.ts` checks `allowedWriteGlobs` (including
     governance-exempt paths when a child explicitly restricts `allowedWriteGlobs`: a subagent with a narrowed
     `writeScope` may ONLY write paths matching its `allowedWriteGlobs`).
   - A pure sanitizer `sanitizeSubagentReport(value: JSONValue): { value: JSONValue; sanitized: boolean;
     detectedTags: string[]; detectedCategories: string[] }` in
     `packages/agent-runtime/src/tools/handlers/tool/subagent-report-sanitizer.ts` escapes forged harness tags
     (`<system>`, `</system>`, `<user>`, `<environment_context>`, `<compaction-notice>`, `<evidence-restored>`,
     `<skill_instructions>`) and flags prompt-injection override phrases (`ignore previous instructions`,
     `disregard all prior rules`, `system override:`) at the `spawn-agents.ts` and `spawn-agent-inline.ts` relay seams.
   - `common/src/util/orchestration-preset.ts` exports a pure, clock-injected decision function
     `advancePresetStep(input: { preset: PresetShape; currentRole: string | null; event: string; stepCount: number;
     maxSteps?: number; now: number }): PresetStepDecision` that deterministically resolves the next role transition,
     completion state, or error (`unreachable-start-event`, `unconsumed-event`, `step-budget-exceeded`) with zero I/O
     and zero `Date.now()` reads.

### Root Cause

1. **Pillar 1:** `creditVerificationRun` trusts exit code `0` without inspecting stdout/stderr for zero-test vacuous
   runner outputs, and `beforeToolCallImpl` tracks read/write sets without recording `(toolName, args, writeCount)`
   settled-state fingerprints for read-only tools.
2. **Pillar 2:** `FID-2026-1007-004` built the write-side retention and read-side `resolveRetainedPayload` primitive,
   but stopped at spawn-time splicing (`splice.ts`), leaving `LF-004` unrouted.
3. **Pillar 3:** `diffLines` in `skills-discovery.ts` was written as a 13-line `for (let i = 0; ...)` index loop rather
   than an LCS diff, `showMessage` uses a ternary `live ? ... : draft ? ...` that masks `draft` when `live` is truthy,
   and `createSkill` left `baselineSha` unset (`null`) instead of recording the absence of a live file (`'none'`).
4. **Pillar 4:** `runLaw2Gate` only consults `SCOPE.md` with no per-agent narrowing; subagent outputs cross the spawn
   boundary unsanitized; and `orchestration-preset.ts` stopped at static config validation without a pure runtime
   transition function.

### Evidence

```text
Pillar 1 (Vacuous-Verifier & Settled-State Loop):
- packages/agent-runtime/src/echo/enforcement/verification-credit.ts:53-59:
    if (commandSucceeded === true) {
      for (const f of state.dirtyFiles) {
        state.verifiedFiles.add(f)
      }
      state.failureAttributedFiles.clear()
    }
- packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:187:
    const commandSucceeded = !hasCommandFailure(toolResult.content)
- packages/agent-runtime/src/tools/tool-executor/tool-result-inspection.ts:174-188:
    only checks `exitCode !== 0` — zero-test runs with exitCode 0 return no failure.

Pillar 2 (On-Demand Evidence Recovery LF-004):
- packages/agent-runtime/src/evidence/spill-read.ts:138-155:
    export async function resolveRetainedPayload(handle: RetentionHandle): Promise<ResolvedPayload>
    Only callers in repo:
    - packages/agent-runtime/src/evidence/__tests__/retention-hardening.test.ts
    - packages/agent-runtime/src/util/__tests__/simplify-tool-results-omission.test.ts
    Zero model-facing tool handlers call `resolveRetainedPayload` or `loadEvidenceRecords`.

Pillar 3 (SkillOpt Diff & Baseline Pin):
- cli/src/commands/skills-discovery.ts:242-254:
    function diffLines(live: string, draft: string): string {
      const liveLines = live.split(/\r?\n/)
      const draftLines = draft.split(/\r?\n/)
      ...
      for (let i = 0; i < max && out.length < 60; i++) {
        const a = liveLines[i]
        const b = draftLines[i]
        if (a === b) continue
        if (a !== undefined) out.push(`- ${a}`)
        if (b !== undefined) out.push(`+ ${b}`)
      }
    }
- cli/src/commands/skills-discovery.ts:154-160:
    `**${name}** — ${live ? 'trusted' : 'quarantined draft'}`,
    live ? `  version ${live.version} · ${live.description}` : draft ? ...
- common/src/util/skill-management/trust.ts:127-131:
    const baselineSha = readBaselineSha(draft.content)
    const currentLiveSha = liveBefore ? hashChange(liveBefore.content) : null
    if (baselineSha !== null && currentLiveSha !== null) { ... }

Pillar 4 (Subagent Write-Scope Clamp, Report Sanitizer, Preset Stepper):
- packages/agent-runtime/src/echo/pre-write-gates-law2.ts:115-137:
    export function runLaw2Gate(params: { targets: (string | undefined)[]; scopePath?: string })
    (no per-agent allowedWriteGlobs check)
- packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:133-137:
    return { agentName, agentType, value: safeToJSONValue(output) }
    (no tag/prompt-injection sanitization on child output)
- common/src/util/orchestration-preset.ts:30-33:
    "There is deliberately no preset runner: the declaration is validated, never executed."
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/enforcement/vacuous-verifier.ts` — pure vacuous-execution classifier and
  settled-state loop detector
- `packages/agent-runtime/src/echo/enforcement/verification-credit.ts` — Law 3 vacuous-pass credit refusal + telemetry
- `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts` — settled-state loop check + vacuous-check wiring
- `packages/agent-runtime/src/echo/types.ts` & `packages/agent-runtime/src/echo/enforcement-state.ts` — `settledChecks`
  and `allowedWriteGlobs` state fields
- `common/src/tools/constants.ts`, `common/src/tools/list.ts`, `common/src/tools/params/tool/recover-evidence.ts` —
  `recover_evidence` tool schema and registration
- `packages/agent-runtime/src/tools/handlers/tool/recover-evidence.ts` &
  `packages/agent-runtime/src/tools/handlers/list.ts` — `recover_evidence` handler wired to `spill-read.ts`
- `agents/savant/savant.ts`, `agents/researcher/researcher-web.ts`, `agents/detective/detective.ts`,
  `agents/scout/scout.ts` — grant `recover_evidence` to the 4 target roles
- `cli/src/commands/skills-diff.ts` & `cli/src/commands/skills-discovery.ts` — LCS unified `diffLines` + dual
  live/quarantine notice in `showMessage`
- `common/src/util/skill-management/mutations.ts` & `common/src/util/skill-management/trust.ts` — `baselineSha: 'none'`
  pin on `createSkill` and TOCTOU check in `trustSkill`
- `common/src/types/session-state.ts`, `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`,
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` — `allowedWriteGlobs` inheritance and monotone
  clamp
- `packages/agent-runtime/src/echo/pre-write-gates-law2.ts` & `packages/agent-runtime/src/echo/pre-write-gates.ts` —
  enforce `allowedWriteGlobs` at Law 2 pre-write gate
- `packages/agent-runtime/src/tools/handlers/tool/subagent-report-sanitizer.ts`, `spawn-agents.ts`,
  `spawn-agent-inline.ts` — sanitize subagent outputs before parent relay
- `common/src/util/orchestration-stepper.ts` & `common/src/util/orchestration-preset.ts` — pure `advancePresetStep`
  state-machine stepper

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

#### Pillar 1 — Vacuous-Verifier Detection & Settled-State Loop Breaker

1. Create `packages/agent-runtime/src/echo/enforcement/vacuous-verifier.ts` (under 150 lines) exporting two pure
   functions:
   - `detectVacuousVerification(command: string, outputText: string): { vacuous: boolean; reason?: string }`:
     - Only evaluates commands where `detectsVerificationCommand(command)` is `true`.
     - Typecheck/lint commands (`tsc`, `typecheck`, `eslint`, `markdownlint`, `lint:md`, `prettier`) legitimately emit
       empty stdout on exit `0` — they are **never** flagged as vacuous for empty output.
     - Test runner commands (`bun test`, `vitest`, `jest`, `mocha`, `pytest`, `cargo test`, `go test`,
       `npm/pnpm/yarn test`, or `bun run ... test`) are flagged as vacuous when `outputText` matches explicit zero-test
       signatures:
       - `/\b0\s+pass(?:ing|ed)?\b/i` combined with `/\b0\s+fail(?:ing|ed|ures?)?\b/i` (or no non-zero pass count)
       - `/\bno\s+tests?\s+(?:found|matched|to\s+run|executed)\b/i`
       - `/\bcollected\s+0\s+items\b/i` (pytest)
       - `/\[no\s+test\s+files\]/i` (go test)
       - `/\b0\s+specs?,\s+0\s+failures?\b/i` (jasmine/karma)
   - `evaluateSettledStateCheck(params)` over `{ state, toolName, input }`:
     - Applies to read-only inspection/verification tools: `run_readonly_command`, `code_search`, `glob`.
     - Computes a canonical key `toolName + '|' + canonicalizeCheckInput(toolName, input)`.
     - Compares against `state.settledChecks.get(key)`. If `entry.writeCount === state.writeCount`:
       - Increment `entry.repeatCount`.
       - At `repeatCount === 2`: return `status: 'warn'` with a Law 3 steering advisory (`"Bridge crossed: worktree
         state (writeCount=${state.writeCount}) has not changed since this exact ${toolName} check ran. Advance to the
         next step instead of re-proving settled state."`).
       - At `repeatCount >= 3`: return `status: 'block'` with the same reason so the loop breaks mechanically.
     - Whenever `state.writeCount` has advanced (or the key is unseen), reset
       `{ writeCount: state.writeCount, repeatCount: 1 }` and return `status: 'fresh'`.
2. Wire `detectVacuousVerification` into `creditVerificationRun` (`verification-credit.ts`) and `result-lifecycle.ts`
   (passing serialized stdout/stderr text into `afterToolCall`), refusing Law 3 credit and emitting a Law 3 warning +
   `flagged` compliance telemetry when `vacuous === true`.
3. Wire `evaluateSettledStateCheck` into `beforeToolCallImpl` (`tool-pipeline.ts`).

#### Pillar 2 — On-Demand Evidence Recovery Tool (`recover_evidence`, `LF-004`)

1. Add `'recover_evidence'` to `toolNames` and `publishedTools` in `common/src/tools/constants.ts`.
2. Create `common/src/tools/params/tool/recover-evidence.ts` defining `recoverEvidenceParams`:
   - `inputSchema`: `z.object({ toolCallId: z.string().min(1), query: z.string().optional(), offset: ... })`
     with `offset` (`min(0)`) and `limit` (`min(1).max(32000)`).
   - `endsAgentStep: true`
3. Create `packages/agent-runtime/src/tools/handlers/tool/recover-evidence.ts`:
   - Uses `loadEvidenceRecords(projectRoot, runId)` from `../../../evidence/spill-read` (and checks `ancestorRunIds` if
     the record was captured in a parent/sibling run within the same project).
   - Verifies `sha256Hex(record.raw) === record.sha256` before returning any bytes (fail-closed integrity check
     matching `resolveRetainedPayload`).
   - If `query` is provided, filters lines of `record.raw` matching `query` (case-insensitive substring) with line
     numbers; otherwise slices `record.raw` from `offset ?? 0` up to `limit ?? 16000` characters.
   - Returns `{ found: true, toolCallId, toolName: record.toolName, sha256Verified: true, redacted, totalChars, offset,
     returnedChars, content }` or `{ found: false, toolCallId, reason: 'not-in-store' | 'sha256-mismatch' |
     'no-project-root' }`.
4. Register `recover_evidence` in `common/src/tools/list.ts` and `packages/agent-runtime/src/tools/handlers/list.ts`,
   and add `'recover_evidence'` to `agents/savant/savant.ts`, `agents/researcher/researcher-web.ts`,
   `agents/detective/detective.ts`, and `agents/scout/scout.ts`.

#### Pillar 3 — Unified LCS Skill Diff & `create` Baseline-Pin Hardening

1. In `cli/src/commands/skills-diff.ts` and `cli/src/commands/skills-discovery.ts`:
   - Replace `diffLines(live: string, draft: string): string` with a bounded LCS line-diff algorithm
     (`computeUnifiedSkillDiff(live, draft, { contextLines: 2, maxOutputLines: 80 })`).
   - Prepend a `[-removed/+added]` summary line (e.g., `[-3/+12 lines]`) and emit standard `- `, `+ `, and `  ` context
     lines around changed hunks. Return `(identical)` when `removed === 0 && added === 0`.
   - In `showMessage(projectRoot, name)`, when both `live` and `draft` are non-null, compute the `[-N/+M]` delta and
     include:
     `⚠ Pending quarantined draft: v${draft.version} (${deltaSummary} vs live) — run /skills show ${name} --review`
2. In `common/src/util/skill-management/mutations.ts` and `trust.ts`:
   - In `createSkill`, wrap `built.content` with `withBaselineSha(built.content, 'none')` before writing the quarantine
     file and snapshot.
   - In `trustSkill`, check `if (baselineSha === 'none' && currentLiveSha !== null)` and return `{ ok: false, error:
     "Drift detected: the live skill '<name>' was created after this draft was authored..." }`. Legacy drafts where
     `baselineSha === null` keep their existing fail-open warning behavior so backward compatibility is preserved.

#### Pillar 4 — Per-Subagent `writeScope` Clamp, Subagent Report Sanitizer, & Pure Orchestration PresetStepper

1. **Per-Subagent `writeScope` Clamp:**
   - Add optional `writeScope?: string[]` to each item of `agents` in `common/src/tools/params/tool/spawn-agents.ts`.
   - Add `allowedWriteGlobs?: string[]` to `AgentState` (`common/src/types/session-state.ts`), classify it in
     `CHILD_OWN` (`packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts`), and add a monotone clamp
     helper `clampWriteScope(parentGlobs, childGlobs)`:
     - To prevent privilege escalation without complex glob intersection algebra, store `allowedWriteScopeChain` (or
       evaluate every layer in the ancestor chain): a write target must match at least one glob in **each** active
       scope layer (`parent` layer AND `child` layer) in addition to `SCOPE.md`. Thus a child can only *narrow* or
       preserve its parent's write scope, never widen it.
   - Thread `allowedWriteGlobs` into `EnforcementState` via `getOrCreateEnforcement`
     (`packages/agent-runtime/src/echo/enforcement/factory.ts`) and enforce it in `runLaw2Gate`
     (`packages/agent-runtime/src/echo/pre-write-gates-law2.ts`): when `allowedWriteGlobs` is present on the agent, any
     write target that does not match every layer in the scope chain is blocked with
     `Law 2 (writeScope clamp): target "<path>" is outside this subagent's assigned writeScope [...]`.
2. **Subagent Report Sanitizer:**
   - Create `packages/agent-runtime/src/tools/handlers/tool/subagent-report-sanitizer.ts` exporting
     `sanitizeSubagentReport(input: JSONValue)` returning `{ output, sanitized, detectedTags, detectedCategories }`.
   - Recursively walks strings inside `JSONValue` (bounded depth 16, max nodes 2048):
     - Escapes opening/closing harness control tags (`system`, `user`, `assistant`, `environment_context`,
       `compaction-notice`, `evidence-restored`, `skill_instructions`, `echo-refresh` → `&lt;...&gt;`).
     - Neutralizes high-risk prompt-injection phrases (`ignore/disregard all previous/prior instructions/rules`,
       `system override:`, `you are now in unrestricted/developer/sudo mode`) by wrapping them in
       `[blocked untrusted subagent instruction_override]`.
   - Wire `sanitizeSubagentReport` at `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:133` and
     `spawn-agent-inline.ts:258` before returning the child output to the parent context.
3. **Pure Orchestration PresetStepper:**
   - In `common/src/util/orchestration-stepper.ts` (re-exported from `common/src/util/orchestration-preset.ts` to keep
     both files well under the 300-line ceiling), implement `advancePresetStep`:
     - Pure function of `{ preset, currentRole, event, stepCount, maxSteps, now }`.
     - Returns a discriminated union `PresetStepDecision`:
       - `{ action: 'complete'; event: string; completedAt: number; stepCount: number }` when `event` is in
         `preset.completionEvents` (and `currentRole !== null`).
       - `{ action: 'dispatch'; nextRoles: string[]; event: string; fromRole: string | null; dispatchedAt: number;
         stepCount: number }` when one or more roles trigger on `event` (and if `currentRole` declares non-empty
         `transitions`, filters or validates against allowed transitions).
       - `{ action: 'halt'; reason: 'step-budget-exceeded' | 'unconsumed-event' | 'illegal-role-publication' |
         'unreachable-start-event'; message: string; haltedAt: number; stepCount: number }` on error.

### Steps

`implementation_started: true`

1. **Pillar 1 (Vacuous-Verifier & Settled-State Loop Breaker):** Create
   `packages/agent-runtime/src/echo/enforcement/vacuous-verifier.ts`, extend `EnforcementState` in
   `packages/agent-runtime/src/echo/types.ts` and `enforcement-state.ts`, and wire into `verification-credit.ts`,
   `tool-pipeline.ts`, and `result-lifecycle.ts`.
2. **Pillar 2 (`recover_evidence` Tool — `LF-004`):** Register `recover_evidence` in `common/src/tools/constants.ts`,
   `common/src/tools/params/tool/recover-evidence.ts`, `common/src/tools/list.ts`,
   `packages/agent-runtime/src/tools/handlers/tool/recover-evidence.ts`,
   `packages/agent-runtime/src/tools/handlers/list.ts`, and add to `savant`, `researcher-web`, `detective`, and `scout`
   agent definitions.
3. **Pillar 3 (SkillOpt LCS Unified Diff & `create` Baseline Pin):** Upgrade `diffLines` and `showMessage` in
   `cli/src/commands/skills-diff.ts` and `cli/src/commands/skills-discovery.ts` and add `baselineSha: 'none'` pinning
   in `common/src/util/skill-management/mutations.ts` and `trust.ts`.
4. **Pillar 4 (Subagent `writeScope` Clamp, Report Sanitizer, & Pure PresetStepper):** Add `writeScope` to
   `spawn-agents.ts` params, thread `allowedWriteGlobs` through `AgentState` / `spawn-child-fields.ts` /
   `pre-write-gates-law2.ts`, wire `subagent-report-sanitizer.ts` into `spawn-agents.ts` and `spawn-agent-inline.ts`,
   and add pure `advancePresetStep` in `common/src/util/orchestration-stepper.ts` (re-exported from
   `orchestration-preset.ts`).
5. **Verification & Gates:** Write and run unit tests for all four pillars across `packages/agent-runtime`, `common`,
   and `cli`, verify 300-line quality ceilings (`bun run quality:report`), run full workspace typechecks, and stamp
   `fid:verify`.

### Verification

Every test suite below will be created during implementation and is covered by a matching `- gate: test <path>` in
`## Verification Gates`:

- New `packages/agent-runtime/src/echo/__tests__/vacuous-verifier-and-settled-loop.test.ts` — pins vacuous test-runner
  outputs (`0 pass`, `No tests found`, `collected 0 items`, `[no test files]`) refusing Law 3 credit while genuine test
  runs (`12 pass, 0 fail`) and silent `tsc --noEmit` exit `0` runs grant credit; pins settled-state loop warning on the
  2nd identical unchanged check, blocking on the 3rd, and resetting when `writeCount` increments.
- New `packages/agent-runtime/src/tools/handlers/tool/__tests__/recover-evidence.test.ts` — pins `recover_evidence`
  resolving a retained payload by `toolCallId` with SHA-256 verification, query line filtering, `offset`/`limit`
  pagination, and fail-closed refusal on `sha256-mismatch` or `not-in-store`.
- New `cli/src/commands/__tests__/skills-diff-and-create-pin.test.ts` — pins LCS unified diff (`[-N/+M]` header, line
  insertion without cascading false mismatches), `showMessage` surfacing pending draft notice when both live and
  quarantine exist, and `createSkill` `baselineSha: 'none'` refusing `trustSkill` when a concurrent live skill appears.
- New `packages/agent-runtime/src/__tests__/subagent-write-scope-and-sanitizer.test.ts` — pins `writeScope` monotone
  clamp in `runLaw2Gate` (child allowed inside its glob, blocked outside its glob even if in `SCOPE.md`, parent+child
  chain intersection), `sanitizeSubagentReport` escaping `<system>`/`<compaction-notice>` tags and neutralizing
  injection phrases, and `advancePresetStep` pure state-machine transitions with zero clock/I/O reads.

## Verification Gates

- gate: typecheck common
- gate: typecheck agents
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/vacuous-verifier-and-settled-loop.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/recover-evidence.test.ts
- gate: test cli/src/commands/__tests__/skills-diff-and-create-pin.test.ts
- gate: test packages/agent-runtime/src/__tests__/subagent-write-scope-and-sanitizer.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/command-outcome.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:3705e5deba695da490c4adb0ab6505c06857bec6efcc053529c949f42e155818
- verified: 2026-10-16T03:21:53.802Z
- typecheck common: exit 0
- typecheck agents: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/vacuous-verifier-and-settled-loop.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/recover-evidence.test.ts: exit 0
- test cli/src/commands/__tests__/skills-diff-and-create-pin.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/subagent-write-scope-and-sanitizer.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/command-outcome.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 4 — resumed implementation contract

Operator authorization: automation level 3, master-plan execution, 2026-10-15.
Existing source inspection confirms all four gaps remain. Use the existing
post-call `result.text` channel for serialized command output rather than add
a redundant facade argument. The settled-check guard uses consecutive identical
inputs, bounded state, and resets on a new user turn or write epoch; mixed-suite
output with real passing tests must not be rejected for one empty package.
Evidence retrieval searches only the current run and declared ancestor run IDs,
never an arbitrary caller-supplied file path. AgentState's actual declaration
is session-state-agent-state.ts. Scope layers apply even without SCOPE.md and
before governance exemptions; retries and inline children inherit every layer.
Sanitization bounds fail closed by replacing unvisited content, including object
keys. Preset stepping is consumed by the existing preset validator's start-event
check, without enabling an automatic orchestration runner.

Audit: these changes preserve the converged deliverables and existing authorities.
The four promised boundary suites remain mandatory. No production repair or
completed gate is claimed before implementation and measured verification.

### Loop 1 — RED

- **RED:**
  1. Inspected `packages/agent-runtime/src/echo/enforcement/verification-credit.ts:53-59` and
     `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:187`: `creditVerificationRun` receives only
     `commandSucceeded: boolean`, never the command's stdout/stderr text, so it cannot distinguish a real test run from
     a `0 pass / No tests found` vacuous exit `0`.
  2. Inspected `packages/agent-runtime/src/evidence/spill-read.ts:138-155`: `resolveRetainedPayload` and
     `loadEvidenceRecords` exist and are tested, but grep across `packages/agent-runtime/src/tools/handlers/` shows zero
     tool handlers importing `spill-read.ts` (`LF-004` gap).
  3. Inspected `cli/src/commands/skills-discovery.ts:242-254` and `common/src/util/skill-management/trust.ts:127-143`:
     discovered that `baselineSha` drift checking for `patch`/`edit` (`FID-2026-0912-001`), quarantine list pointer
     (`FID-2026-0910-001`), and cold-spawn Scribe drafting (`FID-2026-0912-004` / `FID-2026-1005-003`) are **already
     implemented** in the codebase, whereas `diffLines` is still a naive `liveLines[i] === draftLines[i]` index loop,
     `showMessage` (`skills-discovery.ts:154-160`) hides pending drafts when a live version exists, and `createSkill`
     leaves `baselineSha` unpinned (`null`).
  4. Inspected `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts:40-141`: any new field added to
     `AgentState` without classifying it in `INHERITED_FROM_PARENT`, `CHILD_OWN`, or `NOT_INHERITED_BY_DESIGN` causes a
     compile-time `TS2344` error by design (`FID-2026-0919-028`).
- **GREEN:**
  1. Decomposed the four pillars to target only the verified unbuilt gaps, avoiding any duplication of
     `FID-2026-0912-001`/`-004` (Law 7 & Law 13).
  2. Specified `commandOutputText?: string` threading from `result-lifecycle.ts` → `enforcement.afterToolCall` →
     `creditVerificationRun` → `detectVacuousVerification`.
  3. Explicitly classified `allowedWriteGlobs` in `CHILD_OWN` in `spawn-child-fields.ts` so the
     `FID-2026-0919-027`/`-028` spawn-boundary contracts pass.
- **AUDIT:**
  - Verified every target file's current line count against the 300-line quality ceiling (`protocol.config.yaml`
    `max_file_lines: 300`):
    - `skills-discovery.ts` is **293 lines** (`1-293`) — adding an LCS diff inline would breach the 300-line ceiling!
    - `orchestration-preset.ts` is **297 lines** (`1-297`) — adding `advancePresetStep` inline would breach the 300-line
      ceiling!
    - `pre-write-gates.ts` is **283 lines** (`1-283`) and `tool-pipeline.ts` is **240 lines** (`1-240`).
- **ADVERSARIAL:**
  - **Finding A1 (300-line ceiling breach):** Both `cli/src/commands/skills-discovery.ts` (293 lines) and
    `common/src/util/orchestration-preset.ts` (297 lines) are within 7 lines of the hard 300-line repository ceiling.
    Implementing Pillar 3's LCS diff or Pillar 4's preset stepper inside those files will fail `bun run quality:report`.
  - **Finding A2 (`tsc --noEmit` silent success):** TypeScript `tsc --noEmit` and `eslint` output zero bytes on success.
    A naive vacuous detector that flags empty output would break every `bun run typecheck` and `eslint` verification in
    the repository.
  - **Finding A3 (Monotone `writeScope` intersection):** If a parent subagent has
    `writeScope: ['packages/agent-runtime/**']` and spawns a child with `writeScope: ['cli/**']`, replacing the parent's
    scope with the child's scope would violate the clamp rule and let the child escape the parent's boundary.
- **CHANGE DELTA:** Initial specification + 3 adversarial findings routed to Loop 2 self-correction (8.4%).

### Missed Questions

1. **Question:** How do we add the LCS unified diff to `cli/src/commands/skills-discovery.ts` (currently 293/300 lines)
   and `advancePresetStep` to `common/src/util/orchestration-preset.ts` (currently 297/300 lines) without violating the
   hard 300-line quality ceiling?
   - **Decision:** Extract the LCS unified diff helper into a dedicated leaf module `cli/src/commands/skills-diff.ts`
     (imported by `skills-discovery.ts`), and place `advancePresetStep` in `common/src/util/orchestration-stepper.ts`
     (re-exported by `common/src/util/orchestration-preset.ts`). Both existing modules stay under 295 lines and preserve
     their public exports.
2. **Question:** How should `detectVacuousVerification` distinguish a genuinely silent static-analysis pass (`tsc
   --noEmit`, `eslint`, `prettier --check`) from a vacuous test-runner pass?
   - **Decision:** Gate vacuous output inspection strictly on test-runner commands (`bun test`, `vitest`, `jest`,
     `pytest`, `go test`, `cargo test`, `npm/pnpm/yarn test`, or `bun run ... test`). Static-analysis commands (`tsc`,
     `typecheck`, `eslint`, `markdownlint`, `lint:md`, `prettier`, `cargo check/clippy`, `go vet`) satisfy Law 3 on exit
     code `0` with empty stdout.
3. **Question:** How should `writeScope` clamping work across multi-hop subagent spawns (`Orchestrator → Sub-Orch →
   Forge`) without writing a full regular-language intersection solver for globs?
   - **Decision:** Represent `allowedWriteGlobs` as an array of glob-list layers (`readonly (readonly string[])[]` or
     evaluate both parent and child lists in `clampWriteScope`): a path is permitted only if it matches **at least one
     glob in every active layer** of the ancestor chain AND matches `SCOPE.md`. That guarantees strict monotone
     narrowing (`childScope ⊆ parentScope ⊆ SCOPE.md`) in $O(L \times G)$ regex tests with zero false positives.
4. **Question:** Should `recover_evidence` trigger Law 1 read credit (`filesRead`) when it recovers a compacted
   `read_files` tool result?
   - **Decision:** No. `recover_evidence` recovers a compacted tool-output record (which may be a `read_url`,
     `code_search`, `run_readonly_command`, or window-sliced `read_files` output, and is redacted by Law 12). Law 1
     requires reading the current on-disk file 0-EOF via `read_files` before editing it, as stated in `ECHO.md` Law 1
     Amendment ("Spill-File Authorization").

### Loop 2 — Independent audit and self-correction

- **RED:** Audited the Loop 1 adversarial findings (A1: 300-line ceiling on `skills-discovery.ts` and
  `orchestration-preset.ts`; A2: static-analysis silent exit 0; A3: multi-hop `writeScope` clamp; plus
  `execute-subagent.ts` propagation invariant check at
  `packages/agent-runtime/src/tools/handlers/tool/execute-subagent.ts:75-128`).
- **GREEN:**
  1. Folded `cli/src/commands/skills-diff.ts` and `common/src/util/orchestration-stepper.ts` into Affected Components
     and Proposed Solution so no file approaches 300 lines.
  2. Folded the test-runner-only guard into `detectVacuousVerification` so `tsc`/`eslint` exit `0` is never marked
     vacuous.
  3. Specified layer-by-layer conjunction for `allowedWriteGlobs` clamping, and noted that because `allowedWriteGlobs`
     can be narrowed per child when `writeScope` is supplied on `spawn_agents`, it belongs in `CHILD_OWN` in
     `spawn-child-fields.ts` (computed by `createAgentState` as `clampWriteScope(parentAgentState.allowedWriteGlobs,
     childWriteScope)`), NOT in `execute-subagent.ts`'s strict parent===child equality check (which would throw
     `'Constructed child state does not match propagation context.'` whenever a child narrows its parent's write
     scope!).
- **AUDIT:**
  - Verified `packages/agent-runtime/src/tools/handlers/tool/execute-subagent.ts:116-128`: every field in
    `GOVERNANCE_FIELDS` (`enforcementMode`, `designContract`, `protocolSource`, `provenanceMode`) is asserted to be
    strictly `===` between `parentAgentState` and `withDefaults.agentState`. Putting `allowedWriteGlobs` in
    `CHILD_OWN` (constructed in `createAgentState` from `parentAgentState.allowedWriteGlobs` clamped with the spawn's
    `writeScope`) satisfies `spawn-child-fields.ts`'s exhaustive `AssertNever` check while allowing the child to hold a
    narrower scope than its parent without tripping `executeSubagent`'s equality throw.
- **ADVERSARIAL:**
  - **Verdict:** CONFIRMED. Moving `allowedWriteGlobs` to `CHILD_OWN` (clamped from parent at construction in
    `createAgentState`) prevented a guaranteed runtime throw in `executeSubagent` whenever `writeScope` is used.
- **CHANGE DELTA:** 4.1% (below 10% cap).

### Loop 3 — Final convergence

- **RED:** Re-checked all four pillars against the Five Questions, Law 4 call-graph reachability, and
  `fid-verification-contract-sweep.ts` (every promised `*.test.ts` file is listed in `## Verification Gates`).
- **GREEN:** Verified that all four promised test paths in `### Verification` match the four `- gate: test <path>` lines
  in `## Verification Gates` byte-for-byte, and `implementation_started: false` is declared as a standalone line under
  `### Steps`.
- **AUDIT:**
  - **Verifier verdict:** PASS (pre-implementation FID audit). All required sections (`## Summary`, `## Environment`,
    `## Detailed Description`, `## Impact Assessment`, `## Proposed Solution`, `## Perfection Loop`,
    `### Missed Questions`, `### Code Verification Evidence`, `## Resolution`, `## Lessons Learned`) are present, zero
    placeholders exist, all 4 Missed Questions carry explicit `Decision:` lines, and every `file:line` citation was
    verified against the live working tree.
- **ADVERSARIAL:**
  - **Adversary verdict:** CONFIRMED. Zero unresolved findings across two consecutive passes (Loop 2 → Loop 3 delta
    1.1% < 2% convergence threshold). Ready for operator approval to enter implementation.
- **CHANGE DELTA:** 1.1% (converged).

### Implementation Evidence (REQUIRED for `closed`)

- **Commit SHA:** implementation is present; commit is the next lifecycle step.
- **Production wiring:** creditVerificationRun calls detectVacuousVerification;
  beforeToolCallImpl calls evaluateSettledStateCheck; the native handler catalog
  registers handleRecoverEvidence; four role definitions expose recover_evidence.
  showMessage and showDraftReviewMessage consume computeUnifiedSkillDiff;
  createSkill stamps the absence pin checked by trustSkill. Both child-spawn
  paths inherit clampWriteScope, runLaw2Gate checks every layer, and both relay
  seams consume sanitizeSubagentReport. validatePreset calls advancePresetStep.
- **Gate output:** root typecheck exit 0; common 911 PASS / 4 SKIP / 0 FAIL;
  agents 166 PASS / 0 FAIL; focused runtime 32 PASS / 0 FAIL; skill review
  suites 19 PASS / 0 FAIL. Full runtime initially exposed a stale green-run
  fixture with hardcoded red output; the fixture now serializes its actual
  result. Subsequent full runtime: 2,195 PASS / 0 FAIL.
- **Step statuses:** Steps 1–4 implemented and tested. Step 5 final root tests,
  lifecycle receipts and commit are in progress. No live UI result is claimed.

### Code Verification Evidence

- [x] Files referenced in Affected Components (existing seams) exist and were read:
  - `packages/agent-runtime/src/echo/enforcement/verification-credit.ts:1-127`
  - `packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:1-240`
  - `packages/agent-runtime/src/evidence/spill-read.ts:1-156`
  - `cli/src/commands/skills-discovery.ts:1-293`
  - `common/src/util/skill-management/mutations.ts:1-295`
  - `common/src/util/skill-management/trust.ts:1-299`
  - `packages/agent-runtime/src/echo/pre-write-gates-law2.ts:1-137`
  - `packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts:1-238`
  - `packages/agent-runtime/src/tools/handlers/tool/execute-subagent.ts:1-223`
  - `common/src/util/orchestration-preset.ts:1-297`
- [x] Implementation matches the Proposed Solution with the Loop 4 corrections.
- [x] Root typecheck and focused tests pass with measured output above.
- [x] Production callers exist at the implementation seams listed above.
- [x] Implementation has started; final commit and lifecycle gates remain active.

## Resolution

- **Closed Date:** Not closed; implementation present and final gates running.
- **Fix Description:** All four pillars implemented with existing storage and governance seams.
- **Tests Added:** Four declared boundary suites and corrected outcome fixture.
- **Verification Evidence:** Measured focused and workspace outputs above; final receipt follows.

## Lessons Learned

1. **Always verify prior design reviews against current code before scoping a FID (FID Ground-Truth Rule):** Three
   items described as unbuilt in the 2026-09-09 SkillOpt blueprint (`patch`/`edit` `baselineSha` pinning, quarantine
   pointer on `/skills list`, and cold-spawn Scribe drafting) had already shipped in `FID-2026-0912-001`, `-004`, and
   `FID-2026-1005-003`. Reading the live modules 0-EOF exposed the *actual* remaining defects (index-aligned
   `diffLines`, masked draft notice on `/skills show`, and unpinned `createSkill` TOCTOU).
2. **Check `executeSubagent`'s propagation equality invariant before classifying a new `AgentState` field:** Fields in
   `INHERITED_FROM_PARENT` that are also checked in `executeSubagent` must be byte-equal between parent and child; any
   field that a child may narrow at spawn time (such as `allowedWriteGlobs`) must be classified in `CHILD_OWN` and
   computed from the parent state inside `createAgentState`.

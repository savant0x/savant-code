# FID: skill_manage tool output does not match the canonical command-result template

**Filename:** `FID-2026-0908-001-skill-manage-output-template-parity.md`
**ID:** FID-2026-0908-001
**Severity:** medium
**Status:** closed
**Created:** 2026-09-08 16:36
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0824-012 (S2-B authored the skill_manage handler);
FID-2026-0817-002 (B3 — the run_readonly_command canonical shapes);
FID-2026-0823-009 (the verification-gate contract this document follows)

---

## Summary

`skill_manage` returns a bespoke JSON envelope (`{ok, error}` on failure,
`{ok, name, version, action, nextSha, pendingTrust}` on success) instead of the
harness's canonical single-command tool-result template — the
`{command, stdout, stderr, exitCode}` shape every command-class tool returns
(`run_readonly_command` / `run_terminal_command`). Operator directive
(2026-09-08): make `skill_manage` match the full system; the "run single
command" tool carries the template.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** working tree at v0.0.30 prep (uncommitted); automation
  level 3
- **Evidence:** all cited files read 0-EOF this session (2026-09-08)

## Detailed Description

### Problem

Observed live 2026-09-08 (operator-visible tool results, this session):

```text
{"ok":false,"error":"agent-authored description must be 1-60 characters"}
{"ok":true,"name":"release-workflow","version":"0.2.0","action":"edit",
 "nextSha":"sha256:3893cff43ff75ac1a93c8fe7c6bfbdafad4239cae1e8ae07d21741aa3147a4c7",
 "pendingTrust":true}
```

Failure and success are signaled by a bare boolean plus a prose `error` string —
no `exitCode`, no `stderr` channel, no `stdout`. Every command-class tool in the
harness returns the `{command, stdout, stderr, exitCode}` envelope;
`run_readonly_command` rejections, for example, emit
`stderr: "run_readonly_command rejected: …", exitCode: 1`. The model, the
transcript renderers, and the structured-card layer are built around that
contract.

### Expected Behavior

`skill_manage` output matches the run-single-command template: success =
`exitCode: 0`, empty `stderr`, human-readable `stdout` summary; failure =
`exitCode: 1`, the reason on `stderr`, empty `stdout` — while retaining the
machine-readable identity fields (`name`, `version`, `action`, `nextSha`,
`pendingTrust`) that the trust boundary records.

### Root Cause

`packages/agent-runtime/src/tools/handlers/tool/skill-manage.ts` was authored
(FID-2026-0824-012 S2-B) with `jsonToolResult(resultToValue(result))` — an
ad-hoc `{ok, error}` mapping — instead of the shared command-result envelope.
No convention check compared the new handler's output shape to sibling
command-class handlers.

### Evidence

- `skill-manage.ts:7` imports `jsonToolResult`; lines 20-44 define
  `OutputValue {ok, …}` + `resultToValue`; the handler returns
  `jsonToolResult(resultToValue(result))`.
- Canonical template: `run-readonly-command.ts:31-44` (rejection:
  `{command, stdout: '', stderr, exitCode: 1}`) and the delegated
  `run_terminal_command` result shape; `handlers/list.ts:109` and `:116`
  register both tools side by side.
- Live outputs quoted above (operator-visible this session).
- No dedicated `skill_manage` renderer exists (`cli/src/components/tools/`
  grep: zero matches) — the generic fallback renders the JSON verbatim, so the
  shape mismatch is operator-visible.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/skill-manage.ts` (the
  mapping — `OutputValue` + `resultToValue(result, attemptedAction)`)
- `packages/agent-runtime/src/tools/handlers/tool/__tests__/skill-manage.test.ts`
  (new — handler-level pins; the pre-existing `skill.test.ts` covers the
  `skill` LOAD tool, not `skill_manage`)
- `common/src/tools/params/tool/skill-manage.ts` (the declared zod output
  contract — `outputValueSchema`, registered via `list.ts:102`
  `skill_manage: skillManageParams`)
- Not affected: `common/src/util/skill-management.ts` engine +
  `SkillManageResult` (internal contract stays; mapping happens at the handler
  boundary — Law 13, one truth)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: governance-tool output-contract change; agent-side consumers
      (prompts parsing tool results, trust-boundary bookkeeping, transcript
      rendering) assume the template. No data risk — the VERSIONS.jsonl ledger
      writes are engine-side and untouched.
- [ ] Low

## Proposed Solution

### Approach

Map at the handler boundary only. `resultToValue` becomes a template mapping:
success → `{action, name, version?, nextSha?, pendingTrust?, stdout: <summary
line>, stderr: '', exitCode: 0}`; failure → `{action, stderr: result.error,
stdout: '', exitCode: 1}`. The current `message` field folds into `stdout`
(single truth — no duplicate channel). Update the declared output type/schema
for `skill_manage` if one exists in `common/src/tools/list.ts`; the engine and
`SkillManageResult` stay untouched.

### Steps

1. [x] **RED (2026-09-08):** new handler-level suite `skill-manage.test.ts`
       (the pre-existing `skill.test.ts` covers the `skill` LOAD tool, so
       `skill_manage` had zero handler pins) — 4 pins for the template envelope
       on success and failure paths; first run: **4 fail / 0 pass** (`exitCode`
       undefined against the `{ok}` shape).
2. [x] **GREEN (2026-09-08):** `resultToValue(result, attemptedAction)` maps
       onto the template (success → `exitCode: 0` + `stdout` summary with
       identity fields; failure → `exitCode: 1` + exact engine error on
       `stderr`); `outputValueSchema` in the params file reshaped to match.
       `SkillManageResult` engine + its 12-test suite untouched.
3. [x] **VERIFY (2026-09-08):** typecheck common + packages/agent-runtime
       exit 0; `skill-manage.test.ts` 4/0 (22 expects); `skill.test.ts` 6/0;
       engine suites 12/0; eslint `--max-warnings 0` on all touched files;
       prettier clean; `quality: PASS (1467 baselined files)`; Law 4 grep —
       registration at `handlers/list.ts:116` unchanged, `skill_manage` wired
       in the bundled agent toolNames.

### Verification

Gates below run green with a stamped receipt. The live `skill_manage` probe
RAN 2026-09-08 (`dev/scratchpad/active/skill-manage-template-probe.ts` — real
handler, temp root): create/delete/failure envelopes printed operator-visibly;
output pasted in Loop 3.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/skill-manage.test.ts

### Verification Receipt

- fingerprint: sha256:87b5c1ca936d6882e124c4e0ba2d3f54672723c4fd0cb1b497fcf83ee880d3b3
- verified: 2026-09-08T22:34:34.560Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/skill-manage.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the contract divergence cataloged above with file:line evidence and
  live outputs.
- **GREEN:** the handler-boundary mapping proposed above; engine untouched.
- **ADVERSARIAL pre-check:** "Why not change the engine's `SkillManageResult`?"
  → three CLI scripts (`lessons-to-skills.ts`, `evolve-skills.ts`,
  `skills-check.ts`) consume engine results directly; changing the engine
  spreads the migration across non-tool consumers. The tool boundary is the
  only place the harness contract applies. "Why drop `ok`?" → `exitCode` is the
  canonical success signal; keeping both invites divergence.
- **CHANGE DELTA:** initial authoring.

### Loop 2 — Implementation verification (2026-09-08)

- **RED (pasted):** `bun test src/tools/handlers/tool/__tests__/skill-manage.test.ts`
  (cwd agent-runtime) → **4 fail / 0 pass** — `Expected: 0 Received: undefined`
  on every `exitCode` pin (the `{ok}` envelope carried no template fields).
- **GREEN (pasted):** same suite after the mapping → **4 pass / 0 fail, 22
  expect() calls**; sibling `skill.test.ts` 6/0; engine suites
  (`skill-management.test.ts` + `-patch.test.ts`) 12/0 / 42 expects — engine
  untouched.
- **Gates (pasted):** `typecheck common` exit 0 · `typecheck
  packages/agent-runtime` exit 0 · eslint (3 touched files)
  `--max-warnings 0` exit 0 · prettier clean (post `--write`) · `quality: PASS
  (1467 baselined files)`.
- **Gate-path correction (recorded):** the authoring-time gate
  `test …/skill.test.ts` named the `skill` LOAD suite (and that path collides
  with the vendored `resources/freebuff-main` copy under root-cwd `bun test` —
  pre-existing hazard, LEARNINGS). Corrected to `test …/skill-manage.test.ts` +
  `typecheck common` (the params schema edit) before stamping.
- **CHANGE DELTA:** <10% (evidence + status fields only).

### Loop 3 — Independent Verifier audit + self-correct (2026-09-08)

- **AUDIT (Verifier, against the conversation record):** 3 PASS (handler
  mapping arms; receipt 3/3 stamped + `--check` PASS; engine untouched — zero
  write calls target `common/src/util/skill-management/*`, suites 12/0), 2
  FAIL, 4 NEEDS-REVIEW.
- **FAIL 1 → FIXED:** `outputValueSchema.exitCode` was `z.number()` (looser
  than the handler's `0 | 1` type — the FID's "same contract" claim was
  overstated); now `z.union([z.literal(0), z.literal(1)])`. Prettier clean;
  typecheck common, cli, and sdk all exit 0 post-edit.
- **FAIL 2 → FIXED:** the promised live probe RAN (exit 0,
  `dev/scratchpad/active/skill-manage-template-probe.ts` — real handler against
  a temp root, removed in `finally`). Envelopes verbatim (create line
  pretty-printed for line length):

  ```text
  create  → {"action":"create","name":"probe-template-skill","version":"0.1.0",
    "nextSha":"sha256:c144…","pendingTrust":true,
    "stdout":"skill 'probe-template-skill' create at v0.1.0 — quarantined, pending operator trust",
    "stderr":"","exitCode":0}
  delete  → {"action":"delete",…,"pendingTrust":false,"stdout":"skill 'probe-template-skill' delete at v0.1.0","stderr":"","exitCode":0}
  failure → {"action":"create","stdout":"","stderr":"invalid skill name: Invalid Name!","exitCode":1}
  ```

  Verdict: `probe PASS — skill_manage emits the canonical template`.
- **NEEDS-REVIEW dispositions:** (a) fixture cast
  `{ projectRoot } as ProjectFileContext` is the established sibling pattern
  (`ponytail-debt.test.ts:39`, `skill.test.ts:32`,
  `transition-phase.test.ts:31`) — followed per Law 11. (b) typecheck scope —
  cli + sdk typechecks re-run after the schema edit, both exit 0. (c)
  command-slot parity — the canonical command result is
  `{command, stdout, stderr, exitCode}`; `skill_manage` intentionally omits
  `command` (no argv equivalent exists) and carries `action` + identity fields
  in that slot; the operator directive targeted the result envelope
  (`stdout`/`stderr`/`exitCode`), so this is recorded as the disposition — a
  `command` echo field can be added at operator direction.
- **CHANGE DELTA:** <10% (audit record + schema literal).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (`skill-manage.ts` 151
      lines post-format; `skill-manage.test.ts` new; `common/src/tools/params/tool/skill-manage.ts`
      edited)
- [x] Implementation matches the Proposed Solution (handler-boundary mapping;
      engine + `SkillManageResult` untouched — engine suites green without
      modification)
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence: registration at `handlers/list.ts:116`
      unchanged; `skill_manage` present in bundled agent `toolNames` (Law 4
      grep, 2026-09-08)
- [x] FID status reflects the actual implementation state (`fixed`)

### Missed Questions

1. *Does anything parse tool-side `skill_manage` output today?* → GREEN
   verifies: engine consumers read `SkillManageResult` directly, not tool
   output; agent-side, the model reads the rendered transcript — the template
   exists for it.
2. *Batch shape?* → `skill_manage` has no batch mode (one action per call);
   the single-command template applies.
3. *Does the TUI structured-card layer key on `ok`?* → no dedicated renderer
   exists (grep: zero matches); the generic fallback renders whatever JSON
   arrives — the shape change is render-safe.

## Resolution

- **Fixed Date:** 2026-09-08
- **Fix Description:** `resultToValue` maps every `skill_manage` outcome onto
  the canonical single-command template — success → `{action, name, version,
  nextSha, pendingTrust, stdout: <summary or engine message>, stderr: '',
  exitCode: 0}`; failure → `{action, stdout: '', stderr: <exact engine error>,
  exitCode: 1}` — and `outputValueSchema`
  (`common/src/tools/params/tool/skill-manage.ts`) declares that shape. The
  `ok`/`error`/`message` channels are gone (`exitCode` is the success signal;
  `message` folds into `stdout`). Engine + `SkillManageResult` untouched
  (three CLI script consumers unaffected).
- **Tests Added:** Yes — `skill-manage.test.ts` (4 handler-level pins: success
  envelope, invalid-name failure, missing-skill patch failure, message-fold),
  RED-first.
- **Verification Evidence:** RED 4-fail pasted in Loop 2; typecheck ×2 exit 0
  (+ cli/sdk post-audit); eslint 0; prettier clean; `quality: PASS`; live
  probe PASS (envelopes pasted in Loop 3); receipt machine-stamped below.
- **Archived:** 2026-09-08 — closed + archived to `dev/fids/archive/` by
  operator directive ("Close + archive FID-2026-0908-001 with a CHANGELOG
  entry") under the standing T17-C rule (scope-complete, green receipt, no
  open boundaries — the live probe already ran in Loop 3). Receipt
  re-stamped at the archived path (3/3 declared gates live PASS).

## Lessons Learned

- A new handler's output shape needs a convention check against sibling
  command-class handlers at authoring time — the bespoke `{ok, error}` envelope
  shipped green because nothing compared it to the
  `{stdout, stderr, exitCode}` template its registration neighbors return.
- Root-cwd `bun test <path>` substring-matches the vendored
  `resources/freebuff-main` copies — verify the vendored tree lacks a path
  before declaring it as a FID test gate.
- **Handler-output sweep (2026-09-08, operator directive):** all 48 declared
  tool schemas grep-swept — zero `ok: z.boolean()` envelopes remain (this
  handler was the only one), zero `z.any()`. The only `{ok}` unions left
  (`recorder-stall-check.ts:36`, `spawn-agent-resolution.ts:91`) are internal
  control-flow Result types, never tool-output envelopes. The operator-named
  handlers (`transition_phase`, `update_goal`, `spawn_agents`) read 0-EOF: all
  schema-par (`{message}` / `{message, phase}` / per-child
  `{agentName, agentType, value}` with `errorMessage` on failure). Structural
  guarantee: `SavantCodeToolOutput<T>` is type-mapped from the declared schema
  and every handler `satisfies SavantCodeToolHandlerFunction<T>` — handler↔
  schema drift is a compile error; this defect slipped through only because
  handler AND schema jointly declared the bespoke shape (the convention-check
  gap above). Verdict: no further divergence; no new FID warranted.
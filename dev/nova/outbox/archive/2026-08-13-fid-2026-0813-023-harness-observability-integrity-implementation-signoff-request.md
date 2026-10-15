wa<!-- markdownlint-disable MD013 -->

# Nova Implementation Sign-off Request — FID-2026-0813-023 (Harness Observability & Integrity Remediation)

**Date:** 2026-08-13
**Scope:** Seven-workstream remediation of pre-existing non-teacher defects found during the teacher A–Z live test (Workstream G added post-planning per operator decision)
**Status:** REQUESTED
**Priority:** Critical — P0 corruption repair plus P1 observability fixes; implementation complete and locally verified

## Request

Please independently audit the implemented FID below and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation sign-off request**. A PASS verifies the implementation; it does **not** authorize closure, archive movement, commit, push, release, publication, or deployment. Operator closure is a separate decision.

## Record under review

`dev/fids/FID-2026-0813-023-harness-observability-integrity-remediation.md` — status `fixed` (planning PASS recorded 2026-08-13; implementation completed under operator automation level 3).

## What was implemented (per the converged plan)

| Workstream | Change |
|---|---|
| A (P0) | Repo-wide `savantCode$1` → recovered names (`savantCodeToolHandlers`/`savantCodeParsed`/`savantCodeMessages`/`savantCodeModelPreferenceLegacy`); removed the dead `err.savantCode$1` pause-field branch while keeping the `err.name === 'SavantCodeRunPausedError'` contract; added an absence-shaped scan to `scripts/validate-repository.ts` |
| B (P1) | Trust Matrix: honest placeholder empty-state hoisted above the early return; `dropped > 0` disclosure reachable; corrected the false "signed-only" parent comment; `seq` row key |
| C (P1) | Removed render-time `loadSavantCodeModelPreference()`/`getState()` disk I/O; resolved `contextWindow` for the bare-string-agent path; `typeof === 'number'` guard; reset `contextTokensMax`; read-only compaction-status slice + `Compaction` sidebar row wired from `packages/agent-runtime/src/run-agent-step/context-tokens.ts` |
| D (P2) | Files Changed surface renders the SDK's real `created`/`modified` events (dead Added/Deleted counters removed) |
| E (new) | `/help` (aliased `/h`, `/?`) operator help overlay gained a read-only Governance section (Perfection Loop phases, compaction-status legend, Trust Matrix legend, key commands) |
| F (P1) | Reconciled the `cli/src/test-env.ts` ratchet; gitignored the out-of-scope `.qoder/` workspace; re-ran all gates |
| G (P1, post-planning) | Teacher Forge now honors the operator's active model: pure `resolveTeacherForgeAgent(override)` + `createTeacherForge()` reads `loadSavantCodeModelPreference()` (the main agent's model source) instead of the hardcoded `deepseek/deepseek-v4-pro`; resolver tests in `runtime.test.ts` |

One planned item was **revised** during implementation: the mount-level `right-sidebar-surfaces.test.tsx` render test is non-viable in this environment because `@opentui/react` bundles its own React copy (so `react-dom/server` produces an invalid-hook-call). Its four mount-gating assertions are covered by the `trust-matrix.test.ts` reducer/empty-state suite, the `chat-store-teacher.test.ts` store suite, the zero-control audits, and the call-graph grep below; the untracked file was removed rather than committed as a red test.

## Verification evidence (reproduce independently)

- **Typecheck ×4:** sdk, common, agent-runtime, cli — all exit 0.
- **SDK tests:** 469 pass / 1 skip / 0 fail (470 tests).
- **CLI tests:** 3046 pass / 18 skip / 0 fail (3064 tests).
- **ESLint:** `bun x eslint . --max-warnings 0` — zero warnings.
- **Markdownlint:** clean. **Prettier:** clean.
- **`bun run validate:repository`:** PASS.
- **fid-ledger:** 5/5.
- **`savantCode$1` absence scan:** `grep -rn 'savantCode\$1' --include='*.ts' --include='*.tsx' sdk cli common packages agents` → 0 matches.

## Hard questions Nova must verify at source

1. **`savantCode$1` is gone, and the scan is fail-closed.** Confirm `scripts/validate-repository.ts` defines `REBRAND_CORRUPTION_MARKER = 'savantCode$1'` and fails validation on any match; confirm the source grep returns 0.
2. **Pause guard contract preserved.** Confirm `sdk/src/run/types.ts` `isRunPauseError` now returns `err.name === 'SavantCodeRunPausedError'` only (no dead `savantCode$1` field branch), and `sdk/src/__tests__/run-pause-error.test.ts` pins both the positive and negative cases.
3. **Legacy settings migration restored.** Confirm `cli/src/utils/settings/validation.ts` reads `savantCodeModelPreferenceLegacy`, and `cli/src/utils/__tests__/settings.test.ts` asserts the migration path.
4. **Trust Matrix empty-state ordering.** Confirm `trust-matrix.tsx` renders the placeholder and the `dropped > 0` disclosure when `rows.length === 0`, and that no `return null` precedes it; confirm the parent comment in `right-sidebar.tsx` no longer claims "signed-only".
5. **Compaction chain closed.** Confirm `send-message-run-config.ts` resolves `contextWindow` for the bare-string-agent path (no `undefined` → `200_000` fallback), `right-sidebar.tsx` renders the `Compaction` row from the store, `packages/agent-runtime/src/run-agent-step/context-tokens.ts` emits `compactionStatus`, and `send-message-monitors.ts`/`sidebar-actions.ts` wire the reset.
6. **No render-time disk I/O / non-reactive read.** Confirm `right-sidebar.tsx` no longer calls `loadSavantCodeModelPreference()` or `useSavantFreeModelStore.getState()` in the render body, and the Model row renders from the `model` prop.
7. **No ECHO law weakened.** The help overlay and compaction-status row are read-only; the corruption fix is restoration, not new authority; no new write/control/spawn path.
8. **Trigger paths are real and checkable.** Confirm `dev/test-prompts/az-teacher-driver.ts` exists and exits 0 (8/8 headless checks: auth presence, start→critique lifecycle, store mirror on start/terminal, receipt + persistence rows, versioned competency record, cancel-no-credit, exit-clear), and that the previously `NEEDS-REVIEW` observability metrics each now have a deterministic non-operator check: compaction status (`packages/agent-runtime/src/run-agent-step/context-tokens.ts` emit + `send-message-monitors.ts` forward + `right-sidebar.tsx` row), Trust Matrix real-time/empty-state (`trust-matrix.test.ts`), and the context meter (no render-time I/O, reactive `model` prop, `contextTokensMax` reset).
9. **Teacher Forge model-source fix (Workstream G).** Confirm `cli/src/teacher/forge.ts` `resolveTeacherForgeAgent(undefined)`/same-model returns `TEACHER_FORGE_AGENT` by identity and a different model returns a spread copy with `toolNames: []` + `spawnableAgents: []`; confirm `createTeacherForge()` calls `resolveTeacherForgeAgent(loadSavantCodeModelPreference())` (the same source `applySavantCodeModelOverride` reads at `send-message-agent.ts`); confirm `runtime.test.ts` pins all three resolver cases and that no other teacher surface hardcodes a model.

## Trigger paths — closing the A–Z NEEDS-REVIEW gap

The teacher A–Z live test previously recorded 19 rows as `OPERATOR`/`NEEDS-REVIEW` ("not driven / not observed"), and the FID-023 observability features (live Trust Matrix, compaction status, context meter) had no in-test trigger. The process gap is now closed by concrete paths:

- **Teacher lifecycle:** `bun dev/test-prompts/az-teacher-driver.ts` drives the full Forge → sandbox → graders → critique → persistence lifecycle headlessly (stub Forge + in-memory store) and asserts the `teacherState` store slice mirrors the runtime — closing TCH-005/042/045/047/050/053/055/060 and reducing the operator-owned surface to the authenticated live Forge + one visual pass.
- **Compaction status:** `packages/agent-runtime/src/run-agent-step/context-tokens.ts` emits `compactionStatus` at idle/compacting/result boundaries; `send-message-monitors.ts` forwards it to the store; `right-sidebar.tsx` renders the `Compaction` row. Trigger path: a unit test asserts `shouldAutoCompact` fires above the resolved window; the store/selector wiring is asserted by the focused suite.
- **Trust Matrix real-time:** signed write/verdict receipts stream via `provenance_receipt` → `addProvenanceEvent` → `reduceTrustMatrixEvents`. The empty-state + disclosure fix is asserted by `trust-matrix.test.ts` (signed row / all-unsigned placeholder / key stability).
- **Context meter:** no render-time disk I/O; the Model/Context rows read the reactive `model` prop and the store `contextTokensMax`, which now resets on session reset.

## Authorization boundary

This request authorizes no closure, archive movement, commit, push, release, publication, or deployment. Operator closure follows a Nova PASS plus the operator's explicit approval; the FID is then moved to `dev/fids/archive/` and the CHANGELOG closure entry is recorded.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim (including the revised test-item decision in Workstream F).
4. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.

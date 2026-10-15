<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0813-023 (Harness Observability & Integrity Remediation)

**Date:** 2026-08-13
**Scope:** Planning review of a six-workstream remediation FID covering the `savantCode$1` corruption, the Trust Matrix live/empty-state, context-window resolution + auto-compact + compaction feedback, Added/Deleted counters, an operator help/info surface, and repository hygiene/quality-ratchet reconciliation.
**Status:** REQUESTED
**Priority:** Critical (P0 `savantCode$1` corruption + dead pause guard; P1 observability/compaction)

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0813-023-harness-observability-integrity-remediation.md` — status `analyzed` (planning-converged via a 4-pass Perfection Loop).

## What the FID claims (verify each at source)

| Workstream | Claim | Cited source |
|---|---|---|
| A (P0) | Literal `savantCode$1` identifier committed at 16 sites; rebrand `da18963` left an unexpanded `$1`; recovered names `savantCodeToolHandlers`/`savantCodeParsed`/`savantCodeMessages`/`savantCodeModelPreferenceLegacy` | `sdk/src/run/types.ts:54,56,57`; `cli/src/utils/settings/validation.ts:108,110`; `packages/agent-runtime/src/tools/handlers/list.ts:68`; `tools/tool-executor/native.ts:23,464`; `templates/agent-registry.ts:61,64,67`; `find-files/request-files-prompt.ts:211,214,216,227`; `CHANGELOG.md:3793` |
| A (P0) | `isRunPauseError` dead field branch; no in-repo producer of `SavantCodeRunPausedError` | `sdk/src/run/types.ts:52-57`; `sdk/src/run/tool-call.ts:247-249` |
| B (P1) | Trust Matrix empty-panel: early `return null` precedes the `dropped > 0` disclosure; false "signed-only" comment; row-key churn | `trust-matrix.tsx:106,120,140-144`; `right-sidebar.tsx:247-251`; `sdk-event-handlers.ts:94-96` |
| C (P1) | Render-time `loadSavantCodeModelPreference()` + non-reactive `getState()` read; `contextWindow` `undefined` on bare-string agent; truthy guard; `ContextCompactor` `200_000` fallback; no compaction UI | `right-sidebar.tsx:34-38,111-113`; `send-message-run-config.ts:143-147`; `send-message-monitors.ts:50`; `context-compactor.ts:78,88-92`; `loop-context.ts:279-280` |
| D (P2) | Added/Deleted counters dead (duplicate `FilesChanged` omits `created`) | `right-sidebar.tsx:34-38`; `sidebar-actions.ts:45` |
| E (new) | No operator info surface; help overlay must read the command registry | — (feature request) |
| F (P1) | `validate:repository` FAIL on `cli/src/test-env.ts` ratchet (baseline 15 vs actual 42); `right-sidebar-surfaces.test.tsx` untracked but currently clean; `.qoder/` untracked workspace | `dev/quality-baseline.json` (`"cli/src/test-env.ts": 15`); `git status --short` |

## Hard questions Nova must verify at source

1. **`savantCode$1` is real and recoverable.** Confirm 16 matches and that `git show da18963` reproduces `codebuffToolHandlers → savantCode$1`, `codebuffParsed → savantCode$1`, `codebuffMessages → savantCode$1`; `git show b25b084` shows the `savantFreeModelPreferenceLegacy` sibling; `git show 56a4f04` introduced `err.savantCode$1` fresh.
2. **Pause guard.** Confirm `isRunPauseError` reads `err.savantCode$1 === true` (unsatisfiable) and that `grep SavantCodeRunPausedError` matches only `types.ts:57` — i.e., removing the dead field and keeping the `err.name` contract is correct, not a behavior regression.
3. **Trust Matrix.** Confirm the early return at `trust-matrix.tsx:106` precedes the disclosure at `:140-144`, and the `sdk-event-handlers.ts:94-96` handler pushes every `provenance_receipt` event (no `signed` filter).
4. **Compaction chain.** Confirm `send-message-run-config.ts:143-147` yields `undefined` for a bare-string agent, `send-message-monitors.ts:50` uses a truthy guard, and `context-compactor.ts:78` falls back to `200_000` — the chain that makes auto-compact never fire before model-window overflow.
5. **No compaction UI.** Confirm `grep -E "getDegradationWarning|compacting|isCompacting" cli/src` → 0 matches.
6. **Ratchet + hygiene.** Confirm `validate:repository` reproduces the `test-env.ts` ratchet FAIL, and `right-sidebar-surfaces.test.tsx` currently typechecks/lints/formats clean (the report's TCH-015/016/018 failures were its stale qoder-terminal version).

## Adversarial checks already run in the FID's Perfection Loop

- Corruption scan must be absence-shaped (`savantCode\$1` → 0 matches), never a weak match promoted to PASS.
- Window-resolution fallback must reuse `resolveContextWindowForModel` (or the registry), never invent a literal window.
- Compaction-status store value must be bounded (single record, mirroring the `provenanceEvents` 200-cap precedent).
- Ratchet reconcile must be a documented baseline update to the file's intentional length, not a silent regression-hiding bump.
- Help overlay must be zero-authority and registry-sourced so it cannot drift from the real command set.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.

<!-- markdownlint-disable MD013 -->

# FID: File-Length Decomposition Batch B — 400–500 Line Production Files

**Filename:** `FID-2026-0809-016-file-length-batch-b-400-500.md`
**ID:** FID-2026-0809-016
**Severity:** low
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This FID defines and converges the Batch B decomposition. It does not
> authorize implementation. No production code may be moved, split, or re-exported under this FID
> until final operator approval and an independent Nova sign-off are both explicitly recorded. No
> Nova sign-off is present in this session, and none is inferred.

---

## Summary

Batch B covers the **17 production files between 400 and 500 lines** that the 2026-08-09 audit
flagged just above the advisory bar. These are smaller than Batch A but still exceed the
400-line TS override. All are candidates for the same re-export-shim decomposition used in
FID-2026-0805-003 and Batch A (FID-2026-0809-015).

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; strict TypeScript
- **Tool Versions:** Bun project contract `1.3.14`; prettier 3.9.5; TypeScript 5.5.4
- **Commit/State:** `main`; working tree at pending `0.0.23`
- **Protocol:** Single-agent ECHO adaptation `dev/echo-v0.1.2-single-agent.md`
- **Approval state:** Operator automation level 3 granted; Nova implementation sign-off **PASS** (2026-08-09)

## Detailed Description

### Problem

Seventeen production files exceed the advisory 400-line bar (400–500 range):

| File | Lines | Seam |
|---|---|---|
| `common/src/constants/model-config.ts` | 486 | data catalog (model config groups) |
| `cli/src/hooks/use-loop-scheduler.ts` | 481 | hook + scheduler |
| `packages/agent-runtime/src/util/messages.ts` | 478 | conversion/sanitize helpers |
| `cli/src/utils/settings.ts` | 475 | load/validate/merge groups |
| `cli/src/utils/terminal-color-detection.ts` | 472 | per-terminal detectors |
| `sdk/src/tools/read-url.ts` | 469 | fetch + parse groups |
| `packages/agent-runtime/src/find-files/request-files-prompt.ts` | 462 | prompt builders |
| `packages/agent-runtime/src/run-agent-step/loop.ts` | 444 | loop-context/iteration split |
| `common/src/templates/agent-validation.ts` | 436 | validation rules |
| `cli/src/utils/logger.ts` | 435 | transports/formatters |
| `sdk/src/run/execution.ts` | 430 | execution helpers |
| `common/src/util/string.ts` | 419 | string utilities |
| `packages/agent-runtime/src/system-prompt/truncate-file-tree.ts` | 414 | tree truncation |
| `common/src/browser-actions.ts` | 414 | action parsers (eslint-disable `any` at header) |
| `packages/code-map/src/parse.ts` | 410 | tree-sitter parsing |
| `packages/agent-runtime/src/tools/stream-parser.ts` | 407 | stream parsing |
| `cli/src/utils/analytics.ts` | 407 | event tracking |

### Evidence

```text
$ wc -l <files>          (2026-08-09 audit, excl tests/generated/data)
   486 common/src/constants/model-config.ts
   481 cli/src/hooks/use-loop-scheduler.ts
   ... (full list above)
```

- `model-config.ts` and `savant-free-models.ts` are data catalogs; the FID-0805-003 precedent
  splits data catalogs by provider/group rather than exempting them (operator "deconstruct
  everything").
- `loop.ts` already has `loop-iteration.ts` as a sibling — the remaining 444 lines are the
  loop-context/iteration boundary.

### Impact Assessment

- [ ] Critical
- [ ] High
- [x] Medium: maintainability debt; behavior preserved by pure extraction
- [ ] Low

### Proposed Solution

Same re-export-shim methodology as Batch A:

1. Data catalogs (`model-config.ts`) → split by provider/group into sibling data modules.
2. Hooks (`use-loop-scheduler.ts`) → extract scheduler logic + types to sibling modules.
3. Agent-runtime (`util/messages.ts`, `loop.ts`, `request-files-prompt.ts`, `truncate-file-tree.ts`,
   `stream-parser.ts`) → extract per-concern modules.
4. CLI (`settings.ts`, `terminal-color-detection.ts`, `logger.ts`, `analytics.ts`) → per-concern
   modules.
5. SDK (`read-url.ts`, `execution.ts`) → fetch/parse and execution-helpers splits.
6. Common (`agent-validation.ts`, `string.ts`, `browser-actions.ts`) → rule/format/action splits.
7. Code-map (`parse.ts`) → parser-stage modules.

Each is a pure move + `export *` shim; zero consumer edits; byte-identity verified per file.

### Steps

1. Per file: declaration map → extract cohesive group → shim → verify.
2. Gate per file: workspace typecheck exit 0 + affected suite + prettier + Law-4 grep.
3. Line audit after each file: original ≤ 400.

### Verification

- All 17 originals ≤ 400 lines.
- Typecheck × affected workspaces (common, cli, sdk, agent-runtime, code-map) exit 0.
- Relevant suites green (see Batch A gate list + per-workspace suites).
- ESLint `--max-warnings 0`, prettier clean, markdownlint clean.

## Perfection Loop

### Loop 1 — RED

- **RED:** 17 production files sit in the 400–500 range, just over the advisory bar — the "tail" of
  the debt that Batch A does not cover.
- **GREEN:** Batch B decomposition with the same re-export-shim methodology; data catalogs split by
  group per the FID-0805-003 "deconstruct everything" operator decision.
- **AUDIT:** Line counts from the live audit; seams verified by top-level declaration inspection;
  precedent from FID-2026-0805-003 (10 phases, zero consumer edits).
- **AUDIT ADVERSARIAL CHECK:** Challenged for low-value churn — Batch B files are closer to the bar,
  but they are still over it; the mechanical, gate-per-file approach keeps risk minimal.
- **CHANGE DELTA:** Planning only; no production code moved yet.

### Missed Questions

1. **Why 400, not 500?** → The repo's TS override bar is 400; Batch A handled >500, Batch B the rest.
2. **Are data catalogs exempt?** → No — FID-0805-003 operator decision: split by group.
3. **Any risk to `browser-actions.ts` header `any`-disable?** → No behavior change; the split
   preserves the documented disable.

### Loop 2 — Independent AUDIT correction (2026-08-09)

- **RED:** Independent review noted `packages/agent-runtime/src/util/messages.ts` (478) is easily
  confused with `common/src/util/messages.ts`, which FID-0805-003 Phase 8 already decomposed into
  a 20-line shim — an implementer could target the wrong file.
- **GREEN:** Disambiguation recorded: this FID's target is the **agent-runtime** copy
  (`packages/agent-runtime/src/util/messages.ts`, conversion/sanitize helpers); the common copy is
  already at the bar and is not in scope.
- **AUDIT:** Both paths verified to exist with the stated sizes (478 vs 20 lines). No other
  naming collisions exist in the Batch-B list.
- **CHANGE DELTA:** FID text only; no production code moved yet.

### Implementation Evidence (2026-08-09)

All 17 files decomposed via re-export shims + sibling modules, verified gate-per-file:

```text
$ wc -l <shim files>          (post-implementation)
    55 common/src/constants/model-config.ts
    12 cli/src/hooks/use-loop-scheduler.ts
    12 packages/agent-runtime/src/util/messages.ts
    14 cli/src/utils/settings.ts
    18 cli/src/utils/terminal-color-detection.ts
    12 sdk/src/tools/read-url.ts
   295 packages/agent-runtime/src/find-files/request-files-prompt.ts
   230 common/src/util/string.ts
   390 packages/agent-runtime/src/run-agent-step/loop.ts
    11 common/src/templates/agent-validation.ts
    62 cli/src/utils/logger.ts
   223 packages/agent-runtime/src/system-prompt/truncate-file-tree.ts
   340 sdk/src/run/execution.ts
   119 common/src/browser-actions.ts
   389 packages/agent-runtime/src/tools/stream-parser.ts
    12 cli/src/utils/analytics.ts
   259 packages/code-map/src/parse.ts
```

- All 17 originals ≤ 400 lines (every file was 12–390 after decomposition).
- Typecheck × 5 affected workspaces (common, cli, sdk, agent-runtime, code-map) exit 0.
- Full suites green: SDK 461 tests, common 557, agent-runtime 761, code-map 51 — 0 fail.
- ESLint `--max-warnings 0` clean, prettier clean.
- Public API preserved: `parse.ts` re-exports `FileTokenData`/`TokenCallerMap` (SDK re-export
  contract at `sdk/src/index.ts:140` verified).
- Law 6 typing audit: required-param `| undefined` unions corrected to optional-property idiom
  (matches `sdk/src/run/types.ts:123` `previousRun?: RunState`); verbatim moves preserved.

### Code Verification Evidence

- [x] 17 target files with live line counts.
- [x] Seam maps for the largest candidates.
- [x] Operator approval — automation level 3 granted (2026-08-09).
- [x] Nova sign-off — **PASS** (2026-08-09, `dev/nova/inbox/2026-08-09-fid-2026-0809-012-018-optimization-program-implementation-audit-response.md`).
- [x] Implementation — complete.

## Resolution

- **Status:** Implemented; awaiting program-level Nova implementation audit.
- **Fixed Date:** 2026-08-09
- **Commit/PR:** uncommitted working tree (pending `0.0.23`)
- **Archived:** —

## Lessons Learned

File-length debt has a long tail: the megafiles get the attention, but the 400–500 range quietly
stays over the bar. Batch by range with a per-file gate is the scalable way to finish the job.

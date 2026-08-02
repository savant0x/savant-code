# FID: ESLint `savant/no-unknown-in-signatures` Stage-2 Remediation

**Filename:** `FID-2026-0720-032-eslint-unknown-sig-stage-2-remediation.md`
**ID:** FID-2026-0720-032
**Canonical predecessor ID:** FID-2026-0720-032 (duplicate historical ID corrected by FID-2026-0731-004)
**Severity:** medium
**Status:** closed
**Superseded:** By FID-2026-0719-029; the original status prose is retained below for history.
**Superseded-by:** FID-2026-0719-029-eslint-zero-tolerance-push-gate (proper-narrow GREEN strategy supersedes the disable-cleanup premise this FID was built on)
**Created:** 2026-07-20
**Author:** Savant Orchestrator (Buffy)
**Depends-on:** FID-2026-0719-029-eslint-zero-tolerance-push-gate (Stage-1, ~79%-resolved pre-v0.0.3-push)

---

## Metadata Normalization Note

Canonical ID: `FID-2026-0720-032`; Original ID: `FID-2026-0720-032-eslint-stage-2`. Historical body preserved.

## Summary

Stage-1 (FID-029-eslint) cleared the `eslint --max-warnings 0` push gate via 24 file-level ESLint disable comments (the project's `savant/no-unknown-in-signatures` rule currently `'warn'` was suppressed at file level). Stage-2 (this FID) plans the removal/replacement of those escape hatches with proper TypeScript types, then flips the rule to `'error'`.

ECHO Law 6 (per ECHO.md v0.2.0): `any`, `@ts-ignore`, or `unknown` as param/return/var type (outside `v is T` type guard) is **forbidden**. Stage-1 used file-level disables as legitimate escape hatches per FID-029-eslint Q&A strategy. Stage-2 removes those escape hatches with proper type-narrowing.

---

## Environment

- **OS:** Windows 11 (win32)
- **Runtime:** Bun 1.3.14
- **ESLint:** Flat config `eslint.config.js` (custom `savant/no-unknown-in-signatures` rule currently `'warn'`)
- **Rule-flip target:** `'error'` after Stage-2 convergence
- **State (post-FID-029-eslint Stage-1, 2026-07-20):** 24 file-level disables active, 401 / 449 ESLint issues remaining

---

## RED — Current State (after Stage-1)

### Stage-1 added 19 disable comments + 5 extended/pre-existing =

| File | Source | Disable scope |
|------|--------|---------------|
| `cli/src/utils/logger.ts` | prior FIDs | `no-explicit-any, no-unknown-in-signatures` |
| `common/src/util/messages.ts` | prior FIDs | `no-explicit-any` |
| `common/src/types/contracts/logger.ts` | prior FIDs | `no-explicit-any` |
| `common/src/types/session-state.ts` | prior FIDs | `no-explicit-any` |
| `common/src/testing/mocks/database.ts` | FID-029-eslint Stage-1 batch 1 | both rules |
| `common/src/testing/mocks/fetch.ts` | FID-029-eslint Stage-1 batch 1 | both rules |
| `common/src/testing/mocks/child-process.ts` | FID-029-eslint Stage-1 batch 1 | both rules |
| `common/src/util/error.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/cache-debug.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/saxy.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/engagement-tracker.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/analytics-log.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/analytics-sampling.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/axiom-only-log.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/log-data.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `common/src/util/log-ingest.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `agents/types/util-types.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `agents/base2/base-deep.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/clickable.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/button.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/bottom-banner.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/top-banner.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/feedback-container.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/components/tools/apply-patch.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/commands/copy-conversation.ts` | FID-029-eslint Stage-1 batch 2 | both rules |
| `cli/src/index.tsx` | FID-029-eslint Stage-1 batch 2 | both rules |

### Code-reviewer-minimax-m3 flagged 3 conditions on Stage-1 (resolution tracked below)

1. **Per-file rule split (CONDITION 1 — OPEN)**: Bulk script disabled BOTH `savant/no-unknown-in-signatures` AND `@typescript-eslint/no-explicit-any` for every file. Several files (e.g., `feedback-container.tsx`, `index.tsx`, `apply-patch.tsx`, `copy-conversation.ts`, `log-data.ts`, `log-ingest.ts`, `axiom-only-log.ts`, `bottom-banner.tsx`, `top-banner.tsx`) almost certainly have ONLY `unknown` issues — disabling `no-explicit-any` there is over-broad. Files that DO use both rules legitimately (e.g., `error.ts`, `cache-debug.ts`, `messages.ts`) — both disables appropriate. **Action: verify per-file which rule(s) actually fire; split the disable directive to match.**

2. **3 silently-skipped files (CONDITION 2 — RESOLVED 2026-07-20)**: `messages.ts`, `types/contracts/logger.ts`, `types/session-state.ts` were reported as skipped from the bulk script. **Verified (basher 2026-07-20):** All 3 had pre-existing `no-explicit-any` disables from prior sessions — correctly skipped. RESOLVED.

3. **Missing FID follow-up (CONDITION 3 — OPEN)**: This FID (FID-2026-0720-032) is the resolution. Stage-2 cleanup now tracked.

---

## GREEN — Plan

### Approach

For each of the 24+ files with active disables, decide between:

- **(a) Remove disable + replace `unknown` with proper type** — e.g., `safeStringify(obj: unknown): string` → `safeStringify<T>(obj: T): string`
- **(b) Remove disable + introduce type guard `v is T`** — e.g., `parseApiErrorResponseBody(responseBody: unknown): {...}` with internal type-guard validating the input shape
- **(c) Keep disable as legitimate escape hatch** — only for files whose `unknown` truly cannot be replaced (e.g., test fixtures, dynamic event payload shapes from external sources, cross-package Logger interface contract). Justify per-file via audit.
- **(d) Split per-file disable to only the rules firing** — adjust disable directive on per-file basis (Condition #1).

### Step 0: Per-file audit gate

**Pre-audit hypotheses only.** The (a) / (b) / (c) / (d) classifications below are *Likely*-graded scaffolds — they have not been confirmed via per-file ESLint runs. BEFORE applying any classification, run the following per-file probe to confirm which rule(s) actually fire and finalize the action:

```bash
cd /c/Users/spnc/dev/savant-code
for f in \
  cli/src/utils/logger.ts \
  common/src/util/error.ts \
  common/src/util/messages.ts \
  common/src/util/cache-debug.ts \
  common/src/util/saxy.ts \
  common/src/util/engagement-tracker.ts \
  common/src/util/analytics-log.ts \
  common/src/util/analytics-sampling.ts \
  common/src/util/axiom-only-log.ts \
  common/src/util/log-data.ts \
  common/src/util/log-ingest.ts \
  common/src/types/contracts/logger.ts \
  common/src/types/session-state.ts \
  agents/types/util-types.ts \
  agents/base2/base-deep.ts \
  cli/src/components/clickable.tsx \
  cli/src/components/button.tsx \
  cli/src/components/bottom-banner.tsx \
  cli/src/components/top-banner.tsx \
  cli/src/components/feedback-container.tsx \
  cli/src/components/tools/apply-patch.tsx \
  cli/src/commands/copy-conversation.ts \
  cli/src/index.tsx; do
  echo "--$f--"
  bun x eslint "$f" --format compact 2>&1 | grep -oE '@typescript-eslint/[a-z-]+|savant/[a-z-]+' | sort -u
done
```

Audited findings become the canonical (a)/(b)/(c)/(d) classification — hypothesis markup retained in FID for traceability until audit converges.

### Per-file liability classification

Likely (a) — generic refactor with `<T>` or concrete types:
- `cli/src/utils/log-data.ts`, `log-ingest.ts` (likely `<T extends JsonValue>` or similar)
- `common/src/util/analytics-log.ts` (`getAnalyticsEventId`, `toStringOrNull`)
- `cli/src/commands/copy-conversation.ts` (`renderToolInput`)

Likely (b) — type guard introduction:
- `common/src/util/error.ts` (`parseApiErrorResponseBody`, `extractApiErrorDetails` — already partially guarded)
- `common/src/util/cache-debug.ts` (`parseRequestBody`)
- `common/src/util/axiom-only-log.ts` (`getAxiomOnlyLogEvent`)
- `common/src/util/saxy.ts` (XML stream tokens → typed parser)

Likely (c) — keep disable (legitimate escape):
- `common/src/testing/mocks/*.ts` — test fixtures cannot reasonably trim `unknown` without losing expressiveness (5 files)
- `agents/types/util-types.ts` — cross-package Logger interface contract
- `common/src/types/contracts/logger.ts` — Logger interface contract
- `cli/src/utils/logger.ts` — runtime dynamic logger dispatch (may require (b) for specific functions)

Likely (d) — split disable (rules not actually firing):
- `cli/src/components/feedback-container.tsx` — only `unknown` catches, no `any`
- `cli/src/components/bottom-banner.tsx`, `top-banner.tsx` — only `unknown` theme casts, no `any`
- `cli/src/components/tools/apply-patch.tsx` — only `unknown` parseOperation, no `any`
- `cli/src/commands/copy-conversation.ts` — likely only `unknown`
- `cli/src/index.tsx` — likely only `unknown`

### Steps (per file audit, in priority order)

1. Run per-file ESLint to count issues per rule (`bun x eslint <file> --format compact`)
2. For each file, group by case (a) / (b) / (c) / (d)
3. Apply (d) splits first (lowest risk — just disable directive edit)
4. Apply (a) generic refactors (`<T>` migration) where straightforward
5. Apply (b) type guards — most invasive, requires care to avoid runtime regressions
6. For files classified (c) — justify in FID with specific evidence
7. Final: flip `savant/no-unknown-in-signatures` from `'warn'` to `'error'` in eslint.config.js
8. Verify: `bun x eslint <workspace> --max-warnings 0` exits 0 across all 5 workspaces
9. Verify: x4 typecheck GREEN (sdk + common + agent-runtime + cli)
10. Verify: runtime tests pass (`bun test` in affected workspaces)
11. Auto-archive this FID + append CHANGELOG entry

---

## AUDIT — Verification

```bash
# Per-file ESLint after disable removal (zero cases expected)
cd /c/Users/spenc/dev/savant-code
for f in \
  cli/src/utils/logger.ts \
  common/src/util/error.ts \
  common/src/util/messages.ts \
  common/src/util/cache-debug.ts \
  cli/src/components/feedback-container.tsx \
  cli/src/index.tsx \
  agents/types/util-types.ts; do
  echo "--$f--"
  bun x eslint "$f" --max-warnings 999 2>&1 | tail -3
done

# Per-workspace push gate
for w in common sdk cli agents packages; do
  echo "--$w--"
  case "$w" in
    agents) bun x eslint agents/ --max-warnings 0 2>&1 | tail -3 ;;
    packages) (cd packages/agent-runtime && bun x eslint src --max-warnings 0 2>&1 | tail -3) ;;
    *) (cd $w && bun x eslint src --max-warnings 0 2>&1 | tail -3) ;;
  esac
done

# Flip rule severity (post-convergence)
# This is the validation that the eslint.config.js comment's "currently 'warn' — flips to 'error'" handoff happens here.
# sed -i "s/'savant\/no-unknown-in-signatures': 'warn'/'savant\/no-unknown-in-signatures': 'error'/" eslint.config.js

# POST-FLIP RE-VALIDATION (mandatory)
# After the sed flip, the rule severity change MAY introduce new false positives
# that the FID didn't catch pre-flip. Re-run the entire push gate:
for w in common sdk cli agents packages; do
  echo "--$w post-flip--"
  case "$w" in
    agents) bun x eslint agents/ --max-warnings 0 2>&1 | tail -3 ;;
    packages) (cd packages/agent-runtime && bun x eslint src --max-warnings 0 2>&1 | tail -3) ;;
    *) (cd $w && bun x eslint src --max-warnings 0 2>&1 | tail -3) ;;
  esac
done
# All workspaces MUST exit 0. If any workspace now fails, the FID has an incomplete
# gap — DO NOT declare FID-032 closed; iterate.

# x4 typecheck
for w in sdk common packages/agent-runtime cli; do
  echo "--$w--"
  if [ "$w" = "packages/agent-runtime" ]; then
    (cd packages/agent-runtime && bun run typecheck 2>&1 | tail -3)
  else
    (cd $w && bun run typecheck 2>&1 | tail -3)
  fi
done
```

---

## Resolution

**Status:** OPEN — awaiting Stage-2 implementation post-push (after v0.0.3 ships 2026-07-19).

**Estimated scope:**
- ~24 file edits (split disable + targeted replace + inject type guards)
- 1-line `eslint.config.js` rule-flip
- x4 typecheck pass
- Runtime test pass (`bun test`) to verify no regressions
- Test fixtures in `__tests__/` may need companion disable-with-justification (each is a separate audit)

**Acceptance criteria:**
- All 24 file-level disables EITHER removed (with proper type replacement) OR split per-file to match actually-firing rule(s) (Condition #1)
- `savant/no-unknown-in-signatures` flipped to `'error'` in `eslint.config.js`
- 0 ESLint issues across all 5 workspaces (`bun x eslint <each> --max-warnings 0` exit 0)
- x4 typecheck GREEN
- All existing tests pass (`bun test`)
- FID archived to `dev/fids/archive/` per ECHO Auto-Archive rule
- CHANGELOG entry appended per FID Auto-Archive rule

**Preserved (intentional):**
- The `eslint.config.js` `'warn'` setting remains UNTIL this FID converges — premature flip would lock the push gate for any new `unknown` usage that hasn't been narrowed yet
- The 5 `common/src/testing/mocks/*.ts` disables are likely-permanent (legitimate test fixtures) but require explicit per-file justification documentation

**Nested FIDs to consider:**
- If runtime tests regress during Stage-2 refactor (e.g., mock signature changes), create sub-FID before closing this one
- If `parseApiErrorResponseBody` type guard reveals new schema-validation work, that's a separate feature FID

---

## Cross-References

- ECHO.md Law 6 row, TypeScript: "any, @ts-ignore, or unknown as param/return/var type (outside a `v is T` type guard) | Use Instead: The actual domain type; at trust boundaries use a user-defined type guard `v is T` with runtime validation — never a cast"
- `eslint.config.js` comment on line ~57: "Currently 'warn' — flips to 'error' after the cleanup FID resolves the 367 existing `: unknown` usages in src. See dev/fids/"
- FID-2026-0719-029-eslint-zero-tolerance-push-gate (parent FID, Stage-1)
- FID-2026-0719-030 (agent-runtime test exclusion) — closely related; both FIDs deal with ECHO Law 6 type-safety
- **FID-2026-0719-030 / 030.1** (sibling FID, agent-runtime `__tests__/` exclusion + test remediation) — same ECHO Law 6 escape-hatch pattern; the dynamic-agent-template.ts `z.custom` patterns flagged by FID-030 are in the same family as the `unknown`-suppression patterns here. Remediation may overlap (a future Stage-2 refactor of dynamic-agent-template.ts could surface the same `unknown`-narrow issues Stage-2 would address).
- **FID-2026-0719-029-as-cast-tech-debt** (sibling FID; 3 `as` casts in `agent-runtime` to refactor) — adjacent Law-6 territory; the FID's `assertSavantCodeToolMatchesClientTool` type-guard pattern is a Stage-2-compatible model for `(b)` type-guard introductions here.

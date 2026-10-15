# FID: Paid-Build Model Conflation Remediation

**Filename:** `FID-2026-0814-010-paid-build-model-conflation-remediation.md`
**ID:** FID-2026-0814-010
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `IS_SAVANT_FREE` build flag
and the two persisted preference keys; no new state, no new config surface.

---

## Summary

The paid CLI (`savant-code`, the product that actually ships) silently booted the
agent on `minimax/minimax-m3` — a **paid** OpenRouter model — even after the
operator selected a different model. The operator's rule is absolute: **the only
model used project-wide is the one the operator selects in the UI**, and the
fallback must be `openrouter/free`, never a paid model. Two defects broke that
rule, and both are now fixed.

## Environment

- **OS:** Windows (bash via Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Product:** `savant-code` (paid, BYOK multi-provider, on npm) — distinct from
  `savant-free` (unreleased; free-tier partnerships not yet active)
- **State:** working tree; no commit/push/release performed

## Detailed Description

### Problem

Operator reports (verbatim intent):

1. "it keeps defaulting to the model minimax/minimax-m3, even when I switched
   the model to a different model."
2. "it should 'fall back' to openrouter free, not a paid model at all, ever."
3. "why is it even checking the savant-free catalog to begin with?" — the paid
   build must never consult the free catalog or the free model preference.

### Root Cause

Two defects, both in/around the project-wide model store.

**B-09 (P0) — the paid build read the savant-free preference and `switchModel`
polluted it.**

`cli/src/state/savant-free-model-store.ts` `resolveInitialSelectedModel(saved,
savantCodePreference)` was called with `saved = loadSavantFreeModelPreference()`.
Its paid-build branch was:

```ts
if (saved) {
  return IS_SAVANT_FREE ? resolveAvailableSavantFreeModel(saved) : saved
}
```

So in the paid build, a **non-empty `savantFreeModelPreference`** was returned
verbatim — including a stale `minimax/minimax-m3` left over from a free-build
session (or from `switchModel`'s own pollution). Because `resolveActiveModel()`
feeds `applySavantCodeModelOverride` (the single project-wide model decision),
that stale free preference overrode the operator's `/model` selection on every
boot.

Compounding it, `switchModel(model)` unconditionally called
`saveSavantFreeModelPreference(model)`, so every paid-build model selection
wrote into the **free** preference key — the exact key the paid build then read
back on the next launch.

**B-10 (P1) — two agent sources still hardcoded `minimax/minimax-m3`.**

The FID-009 B-08 sweep reconciled the canonical role agents, but two sub-agent
definitions were missed:

- `agents/librarian/librarian.ts:12` → `model: 'minimax/minimax-m3'`
- `agents/tmux-cli.ts:15` → `model: 'minimax/minimax-m3'`

Both are spawned via `withParentModel()` (which replaces the child model with
the parent's), so they are display metadata — but per the operator's rule they
must not carry a paid default either.

### Expected Behavior

- Paid build boot model = `loadSavantCodeModelPreference()` else
  `openrouter/free` (`DEFAULT_SAVANT_CODE_MODEL_ID`). The savant-free preference
  and free catalog are never read.
- Free build boot model = `resolveAvailableSavantFreeModel(saved)` else
  `DEFAULT_SAVANT_FREE_MODEL_ID` (unchanged).
- `switchModel` persists to the correct key per build.
- No non-`savant-free` agent definition carries a paid model literal.

---

## GREEN — Fix (applied)

### B-09

`cli/src/state/savant-free-model-store.ts`:

- `resolveInitialSelectedModel` now branches on `IS_SAVANT_FREE` **first**:
  free build resolves from the free preference/catalog; paid build resolves
  **only** from `savantCodePreference ?? DEFAULT_SAVANT_CODE_MODEL_ID`.
- `switchModel` persists build-aware: paid → `saveSavantCodeModelPreference`,
  free → `saveSavantFreeModelPreference`.
- Added `saveSavantCodeModelPreference` to the settings import.

### B-10

- `agents/librarian/librarian.ts` → `model: 'openrouter/free'`.
- `agents/tmux-cli.ts` → `model: 'openrouter/free'` (kept
  `providerOptions: { data_collection: 'deny' }` — privacy, not billing; B-06).
- Regenerated `cli/src/agents/bundled-agents.generated.ts` via
  `cd cli && bun run prebuild:agents`.

---

## AUDIT — evidence (tool output, not self-report)

1. **Paid-model literals in `agents/` source are gone.**
   `grep -rn "minimax/minimax-m3\|deepseek/deepseek-v4-pro\|openai/gpt-5\|anthropic/claude"`
   `agents --include="*.ts" | grep -v "savant-free"`
   → **NO-MATCH** (exit 0, no output).

2. **Regenerated bundle reconciled.**
   - `librarian` → `model: 'openrouter/free'` (bundle line ~681).
   - `'tmux-cli'` → `model: 'openrouter/free'` (bundle line ~2071).
   - The only remaining `minimax/minimax-m3` / `deepseek/deepseek-v4-pro`
     literals in the bundle are the **savant-free root agents**
     (`savant-free-deepseek` L960, `savant-free-evals` L1042,
     `savant-free-minimax-m3` L1450/L1532) — legitimate free-build agents, not
     reachable from the paid `savant` spawnable roster.

3. **Tests.** `bun test src/state/__tests__/savant-free-model-store.test.ts
   src/utils/__tests__/settings.test.ts` → **27 pass / 0 fail** (56 expect calls).
   The regression test now asserts a stale `minimax/minimax-m3` free preference
   is **ignored** in the paid build and only `savantCodeModelPreference` is
   trusted.

4. **Typecheck ×4 + agents** (`sdk`, `common`, `packages/agent-runtime`, `cli`,
   `agents`) → all exit 0.

5. **ESLint** `--max-warnings 0` on the four edited files → clean.

6. **Prettier** on the four edited files → clean.

---

## ADVERSARIAL

- **B-09 severity** re-confirmed P0: the stale free preference silently
  overrode a paid selection, i.e. a billing-relevant model swap with no notice
  — exactly the "dangerous" case the operator called out. Fix is the minimal
  correct one: the paid build never touches the free key.
- **Omission check:** the `resolveInitialSelectedModel` doc comment (which still
  described the old "paid build trusts saved" behavior) was updated; the
  `resolveActiveModel` line-range citation was corrected to a name reference so
  it cannot drift. `switchModel` callers (`/model`, GUI picker,
  `startSavantFreeSession`) all re-verified build-gated: `startSavantFreeSession`
  no-ops when `!IS_SAVANT_FREE` (`session-state.ts`), and the two paid callers
  also call `saveSavantCodeModelPreference` explicitly, so the new build-aware
  write is idempotent, not divergent.
- **Wrong-N/A check:** `validateSettings` still preserves a non-free-catalog
  `savantFreeModelPreference` in the paid build (`settings.test.ts:137-154`).
  That is correct and unchanged — the paid build now simply never **reads** it,
  so the free build's persistence surface is untouched.
- **Five Questions:** (1) all cases — paid and free branches are exhaustive via
  `IS_SAVANT_FREE`; (2) 1000 agents — sub-agents already inherit via
  `withParentModel`; (3) hostile — a settings file with a crafted free
  preference can no longer force a paid model; (4) 2 years — single seam
  (`resolveActiveModel` → store) unchanged, no new surface; (5) standard — the
  build flag is the one clean product boundary.

**Verdict:** converged; no further findings.

---

## Perfection Loop

### Loop 1 — RED (catalog)

- **RED:** B-09 (`resolveInitialSelectedModel` trusts the savant-free
  preference in the paid build; `switchModel` pollutes it) and B-10
  (`librarian.ts:12`, `tmux-cli.ts:15` still hardcode `minimax/minimax-m3`).
- **GREEN:** branch `resolveInitialSelectedModel` on `IS_SAVANT_FREE` first;
  make `switchModel` build-aware; reconcile the two agent models to
  `openrouter/free`; regenerate the bundle.
- **AUDIT:** six evidence items (grep NO-MATCH, bundle reconciliation, 27/0
  tests, typecheck ×4 + agents, ESLint, Prettier).
- **ADVERSARIAL:** converged; no further findings.

### Missed Questions

1. **Why does the paid build share the savant-free model store at all?** — The
   store is the single project-wide seam (`resolveActiveModel`). Sharing is
   correct; the bug was that its boot resolution read the _free_ preference key
   in the paid build. Fixed by build-aware branching, not by forking the store.
2. **Is `data_collection: 'deny'` on `tmux-cli` still correct after changing its
   model to `openrouter/free`?** — Yes; it is a privacy flag (B-06), not a
   billing/model coupling, so it is retained.

### Code Verification Evidence

- [x] Referenced files exist (`cli/src/state/savant-free-model-store.ts`,
      `agents/librarian/librarian.ts`, `agents/tmux-cli.ts`, the regenerated
      bundle).
- [x] Implementation matches the GREEN section (`resolveInitialSelectedModel`
      now returns `savantCodePreference ?? DEFAULT_SAVANT_CODE_MODEL_ID` in the
      paid branch; `switchModel` writes `saveSavantCodeModelPreference` in the
      paid build).
- [x] Typecheck/tests/lint pass (27/0 tests, typecheck ×4 + agents, ESLint,
      Prettier, markdownlint — pasted in AUDIT).
- [x] Call-graph: `resolveActiveModel` → `applySavantCodeModelOverride`
      (`send-message-agent.ts`) and `teacher/forge.ts`, confirmed during RED.
- [x] Status reflects actual state (`closed`, archived below).

### Loop 2 — Independent audit and self-correction

- **RED:** stale `resolveInitialSelectedModel` doc comment still described the
  old behavior; `resolveActiveModel` line-range citation had drifted.
- **GREEN:** updated the doc comment and replaced the range citation with a
  name reference.
- **AUDIT:** markdownlint + Prettier clean on the FID; re-ran
  validate:repository.
- **ADVERSARIAL:** no behavioral delta; converged.

## Resolution

Implementation complete and verified. Operator authorized closure **without** a
Nova sign-off (2026-08-14, explicit waiver). Closed and archived.

<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Report — Project-wide Paid-Model Reconciliation: Recurring Leak & Root Cause

**Author:** Nova (independent ECHO auditor)
**Date:** 2026-08-14 (~07:15 PM EDT)
**Subject:** The `deepseek/deepseek-v4-pro` paid literal survived B-07/B-08; this is the *second* time a paid-model surface escaped a "complete" reconciliation. Pattern, not incident.

---

## 1. What happened (timeline)

1. **FID-2026-0814-004 (H-08…H-12, P0):** Model-unification work removed paid hardcodes from the **main run path** — `cli/src/teacher/forge.ts`, `agents/thinker/*`, `cli/src/headless-run.ts`. Verified at source: `grep "deepseek/deepseek-v4-pro"` in those paths → 0 matches. PASS.

2. **FID-2026-0814-009 (B-01…B-06):** Prompt-coherence audit. During the gate sweep, Nova independently discovered a **paid-model hardcode in `agents/editor/best-of-n/*`** (`claude-opus-4.8`, `gpt-5.4`, etc.) — **outside** 009's B-01…B-06 scope. Flagged as a residual "operator decision" in the 008/009 audit response. NOT fixed.

3. **Operator directive ("nothing is ever out of scope"):** Expanded 009 to **B-07/B-08** — reconcile *every* paid `model` default across `agents/`.

4. **B-07/B-08 implementation:** Reconciled best-of-n editor, canonical ECHO roles (thinker/context-pruner/detective/recorder/scribe/file-explorer), infra helpers (tmux-cli/browser-use/database/github), forge, verifier, adversary. Request claimed Q2 "regenerated bundle has no paid literals."

5. **Nova re-audit (independent):** I **regenerated the bundle myself** (`bun run prebuild:agents`) and grepped it. **HIT at `bundled-agents.generated.ts:960`** — `savant-free-deepseek` with `model: 'deepseek/deepseek-v4-pro'`. Root cause: `agents/savant/savant-free-deepseek.ts:7` uses `SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID` (= `'deepseek/deepseek-v4-pro'`, paid, `common/src/constants/savant-free-models.ts:54`). **This file was outside the B-07/B-08 enumerated scope.** → **FAIL.**

---

## 2. The recurring pattern (why this is a process bug, not a one-off)

This is the **second** paid-model escape after a "complete" reconciliation:

| Pass | Scope claimed | Missed surface | Caught by |
|---|---|---|---|
| FID-004 | main run path | best-of-n editor (`agents/editor/best-of-n/*`) | Nova, as 009 residual |
| B-07/B-08 | "every paid default in `agents/`" | `agents/savant/savant-free-deepseek.ts` | Nova, independent bundle regen + grep |

Both times the **implementation enumerated a file list** and reconciled those files — and both times a paid literal lived in a file **outside the enumerated list**. The grep-based verification in the request (Q2) was run on a **stale or non-regenerated bundle**, returning a false "no match."

**Root cause = verification relied on the implementation's own artifact (a prebuilt bundle) instead of a freshly regenerated one + a full-tree grep.** The harness trusted its own build output.

---

## 3. The fix (one line, already identified)

`agents/savant/savant-free-deepseek.ts:7`:
```ts
// before
model: SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID,   // = 'deepseek/deepseek-v4-pro' (PAID)
// after
model: 'openrouter/free',
```
Then: `bun run prebuild:agents` → confirm `grep "deepseek/deepseek-v4-pro" cli/src/agents/bundled-agents.generated.ts` returns **zero agent-`model:` assignments**.

(The constant `SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID` may remain as a *catalog display entry* in `savant-free-models.ts` — that is a selectable model list, not a fallback. Only the agent-`model:` default must change.)

---

## 4. Required process change (so this stops happening)

The harness's model-unification passes keep missing surfaces because they grep a **prebuilt bundle** and enumerate a **static file list**. Two hardened gates:

1. **Verify on a FRESH regen.** Every model-unification audit must run `bun run prebuild:agents` immediately before the grep, not trust a pre-existing bundle.
2. **Grep the SOURCE tree, not the bundle.** `grep -rn "deepseek/deepseek-v4-pro\|anthropic/claude-opus\|openai/gpt-5\|claude-opus" agents/ cli/src common/src --include=*.ts` across ALL source (not just the enumerated list). Any `model:` assignment to a paid slug = FAIL.
3. **Scope = invariant, not file list.** "Reconcile every paid default" means a tree-wide grep, not "these 12 files." The operator's directive ("nothing is ever out of scope") demands the tree-wide grep be the scope, not a checklist.

---

## 5. Status

- **B-07/B-08: FAIL** — records pulled back for self-correction (not archived/closed).
- **B-01…B-06: PASS** — unaffected, still valid.
- **FID-004: PASS** — main run path clean; the leak was always in the uncovered `savant-free-*` + `best-of-n` surfaces.
- **Single known remaining paid literal:** `agents/savant/savant-free-deepseek.ts:7` (the only agent importing `SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID` for a `model:` default). After the one-line fix + regen, the project-wide "one model, never paid fallback" invariant is finally closed.

---

*Report by Nova, 2026-08-14. Consolidates: 008/009 residual flag → B-07/B-08 FAIL → root-cause pattern (enumeration-gap + stale-bundle verification) → required process change. The implementation harness should adopt tree-wide grep + fresh regen as the standing gate for any future model-unification pass.*

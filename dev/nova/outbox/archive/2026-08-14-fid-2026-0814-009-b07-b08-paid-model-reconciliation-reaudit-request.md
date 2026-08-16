<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Re-audit Request — FID-2026-0814-009 B-07/B-08 (Project-wide paid-model reconciliation)

**Date:** 2026-08-14
**Scope:** The operator's directive ("NOTHING is ever out of scope unless I say it — default is to expand scope and address the issue") expanded FID-2026-0814-009 to cover the paid-model surface Nova flagged as a residual in the prior 008/009 response.
**Status:** REQUESTED
**Priority:** High (P0 project-wide "one model, never a paid model fallback" invariant)

## Request

Your prior 008/009 implementation audit returned **PASS** for B-01…B-06 and flagged the best-of-n editor paid-model hardcodes as a residual "operator decision". The operator has now decided: reconcile them — and every other paid-model default in `agents/` — rather than defer. Please independently audit the new B-07/B-08 implementation and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation re-audit of the expanded scope only** (B-07/B-08). It does not re-open your B-01…B-06 PASS. It does **not** authorize closure, commit, push, release, publication, or deployment.

## What changed since your prior PASS

Every **paid** `model` default across `agents/` was reconciled to `model: 'openrouter/free'` (display metadata only; the runtime model remains the operator's selection via `withParentModel` at `spawn-agents.ts:127` / `spawn-agent-inline.ts:97`):

- **B-07 — best-of-n editor (`agents/editor/best-of-n/*`):**
  - `editor-multi-prompt.ts` — `anthropic/claude-opus-4.8` → `openrouter/free`.
  - `editor-implementor.ts` — 4-way paid ternary (`claude-sonnet-4.5`/`claude-opus-4.8`/`gemini-3-pro-preview`/`gpt-5.1`) → `openrouter/free`; unused `isSonnet`/`isOpus` locals removed.
  - `best-of-n-selector2.ts` — 3-way paid ternary (`claude-sonnet-4.5`/`claude-opus-4.8`/`gpt-5.4`) → `openrouter/free`.
- **B-08 — canonical ECHO role agents + infra helpers:**
  - `thinker.ts`, `context-pruner.ts`, `detective.ts`, `recorder.ts`, `scribe.ts`, `file-explorer/directory-lister.ts`, `file-explorer/glob-matcher.ts` — paid `claude-*` → `openrouter/free`.
  - `forge.ts` — `EDITOR_MODEL_BY_VARIANT` map deleted (only `opus` was instantiated); `model` → `openrouter/free`; `EDITOR_VARIANTS_WITH_THINK_TAGS` kept.
  - `verifier.ts` / `adversary.ts` — `createReviewer('anthropic/claude-opus-4.8')` / `createAdversary('anthropic/claude-opus-4.8')` → `'openrouter/free'`.
- `cli/src/agents/bundled-agents.generated.ts` regenerated via `bun run prebuild:agents`.

**Left intact (verified free, no billing risk):** the infra/read-only helpers' `google/gemini-3.1-flash-lite` default and the `savant-free-*` free-catalog models (`minimax-m3`, `glm-5.2`, `kimi`, `mimo`, `deepseek-v4-flash`, …). These are already free and are overridden by `withParentModel` at runtime.

## Verification evidence (reproduce independently)

- Typecheck ×4 + `agents` — clean.
- Full suites: agent-runtime 960/0 · common 614/0 · SDK 476/0 · CLI 3088/0 · agents 49/0.
- ESLint `--max-warnings 0`, lint:md, Prettier, `validate:repository` PASS, fid-ledger clean.

## Hard questions Nova must verify at source

1. **No paid model literal remains in `agents/`.** `grep -rn "anthropic/\|openai/gpt\|google/gemini\|deepseek/deepseek-v4-pro\|gpt-5\.\|claude-" agents/ --include=*.ts` → the only matches should be "…hardcode was removed…" comment prose; **zero** `model: '<paid>'` assignments.
2. **Regenerated bundle carries zero paid literals.** `cd cli && bun run prebuild:agents && grep -n "anthropic/claude\|openai/gpt\|google/gemini-3-pro\|deepseek/deepseek-v4-pro" src/agents/bundled-agents.generated.ts` → no match (only `openrouter/free`, free flash-lite, and free savant-catalog slugs remain).
3. **No agent opts out of inheritance.** `grep -rn "inheritParentModel" agents/ --include=*.ts` → only "escape was removed" comment prose; no `inheritParentModel: false`.
4. **`withParentModel` remains the sole runtime model source.** Confirm `spawn-agents.ts:127` and `spawn-agent-inline.ts:97` still apply it unconditionally to spawned subagents.
5. **Forge factory still typechecks and behaves.** `forge.ts` removed `EDITOR_MODEL_BY_VARIANT`; confirm `CodeEditorVariant` is still used (`EDITOR_VARIANTS_WITH_THINK_TAGS` + `options.model`) and `model: 'openrouter/free'` is the only assignment; `createCodeEditor({ model: 'opus' })` still produces the `forge` definition.
6. **Free models correctly left intact.** Confirm `basher.ts` (`GEMINI_3_1_FLASH_LITE_MODEL_ID`) and `savant-free-*` remain on their free models (no accidental paid migration).
7. **No ECHO law weakened / no new authority.** The change only replaces paid model literals with the operator-mandated free fallback; no new tool, store, write path, or authority.

## Authorization boundary

Implementation review of B-07/B-08 only. No closure, commit, push, release, publication, or deployment authority. Operator closure remains a separate decision after your PASS.

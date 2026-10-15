# Session Summary — Paid-Build Model Conflation Remediation (FID-2026-0814-010)

**Date:** 2026-08-14
**Status:** Closed and archived (operator-authorized, no Nova sign-off)

## Scope

The paid CLI (`savant-code`) silently booted on `minimax/minimax-m3` — a paid
OpenRouter model — even after the operator selected a different model. The
operator's rule is absolute: the only model used project-wide is the one the
operator selects, with a `openrouter/free` fallback and never a paid model.

## Findings fixed

- **B-09 (P0):** `resolveInitialSelectedModel` in
  `cli/src/state/savant-free-model-store.ts` trusted the savant-free preference
  in the paid build and `switchModel` polluted it. The paid build now resolves
  only from `savantCodeModelPreference ?? openrouter/free`.
- **B-10 (P1):** `agents/librarian/librarian.ts` + `agents/tmux-cli.ts` still
  hardcoded `minimax/minimax-m3`; reconciled to `openrouter/free`, bundle
  regenerated.

## Verification

- 27/0 model-store + settings tests; typecheck ×4 + agents; ESLint
  `--max-warnings 0`; Prettier; markdownlint; `validate:repository` PASS.
- `quality-baseline.json` ratchet reconciled (librarian 159→161, tmux-cli
  45→47, savant-free-model-store approvedGrowth 93→113 with rationale).

## Boundaries

Working-tree closure only. No commit, push, release, publication, or
deployment was performed. No Nova sign-off requested (explicit operator
waiver).

# Session Summary — 2026-09-19 ~06:30 UTC — FID-2026-0919-018 implemented

> Single-agent ECHO session (solo protocol
> `dev/echo-v0.1.2-single-agent.md`). Operator reported the sidebar showing
> `kiosapi/glm-5.3-flash-free` at `74.0k/200.0k (default)` while
> OpenRouter's `z-ai/glm-5.3-flash` page says 1.3M.

## Diagnosis (live-proven, probe falsified the first hypothesis)

- Probe `dev/scratchpad/probe-glm-flash-window.ts` (verbatim-faithful port
  of `lookup.ts` resolution against the live OpenRouter catalog).
- First hypothesis ("terminal-version regex can't reduce mid-id versions")
  was **wrong**: branch 3b's `familyName !== canonical` guard is the
  decisive skip — for a single-segment canonical that fails branch 3's
  reduction, `familyName === canonical`, so the branch skips exactly when
  an exact terminal-segment twin exists. Verbatim-faithful rerun matches
  the sidebar: every tier misses → 200k `(default)`.
- Tier 2 structurally cannot answer: kiosapi's OpenAI-compatible
  `/v1/models` carries no `context_length`. Tier 3 has no `kiosapi/*`
  rows. Truth: `z-ai/glm-5.3-flash` = 1,310,720; near-collisions
  `glm-5.3-flashx` / `:batch` = 1,048,576 (must not bleed).

## Implementation (FID-2026-0919-018, operator-approved)

- `cli/src/utils/openrouter-models/lookup.ts`: new **branch 2b — exact
  terminal-segment equality** between branches 2 and 3, shared by both
  field resolvers (context window + max output, Law 13).
- Self-caught by the quality gate: the insertion pushed `lookup.ts` to 315
  lines (300 max). `findGatewayModel` extracted move-only to
  `cli/src/utils/openrouter-models/gateway-lookup.ts`, re-exported from
  `lookup.ts` (import paths stable).
- New suite `openrouter-models-fid-0919-018.test.ts` (5 pins): exact twin
  resolution, negative near-collision exclusion (twin removed → default),
  016 terminal-version regression guard, max-output parity, unknown-id
  default.

## Gates (real runs)

typecheck cli 0 · fid-0919-018 5/0 · fid-0919-016 green · lookup 6/0 ·
quality PASS (1498 files) · eslint 0 · lint:md 0 · prettier clean ·
receipt 5/5 via `--write`, `--check` PASS
(fingerprint `sha256:21aaa2c5…`). FID status `verified`.

## Honest notes

- Probe v1 predicted branch 3b would answer — the omission of the 3b guard
  was the bug *in the probe*; corrected before any code moved.
- First FID draft declared gates in prose (`- [ ] gate:`); `fid:verify`
  rejected it — reformatted to `## Verification Gates` + bare `- gate:`
  lines per FID-2026-0917 archive format.
- Commit withheld pending operator authorization (G2); FID-2026-0919-018
  joins the next closure batch with changelog + archive on closure.

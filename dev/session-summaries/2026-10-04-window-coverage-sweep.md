# Session Summary — Gateway context-window coverage sweep (2026-10-04)

## Task

Operator ruling 2026-10-04 (structured ruling on the window-coverage audit):
fix scope = all chat-surface silent-200k ids; sourcing = cross-gateway rows
only (no fresh live probe); prevention = all five presented gates. Registered
as **T128** in `SCOPE.md` (automation level 3), executed under
`FID-2026-1004-002-gateway-window-coverage-sweep.md` (status `verified`,
receipt stamped 12/12 gates).

## Audit verification (RED)

- Re-ran `dev/scratchpad/active/window-coverage-audit.ts` (exit 0; output at
  `dev/scratchpad/active/window-coverage-audit-output.txt`): 264 of 1,843
  runtime-catalog ids resolve to the silent 200k default; 66 rows advertise
  exactly 200000; 5 registry providers have zero rows; table 203 rows, 0
  orphans.
- **Audit correction (measured):** the pasted audit's "166 non-chat"
  classification undercounted chat surfaces — `orcarouter/openai/gpt-5.5`
  (catalog description: "features a 1M+ token…"), `gpt-5.5-pro`,
  `nvidia/moonshotai/kimi-k3` et al. are chat ids silently steered by the
  200k default. True chat-surface gap ≈ 150–160 ids, not 98. Also: kiosapi's
  3 silent ids were already the FID-2026-1003-008 no-row register (no new
  work), and the audit's per-provider table numbers were confirmed correct
  after separating the silent list from the "exactly-200000" list.

## Implementation (GREEN)

- `common/src/constants/context-window-table-apinex.ts` — 32 consensus-sourced
  rows + machine-readable no-row register (4 ids with reasons).
- `common/src/constants/context-window-table-bai.ts` — 41 rows + no-row
  register (18 ids with reasons).
- `context-window-table.ts` — orcarouter (6) + nvidia (9) rows inline with
  grouped no-row registers (orcarouter aliases/legacy, vercel non-chat ×23,
  nvidia non-chat/legacy); two new spreads; imports. Parent 193 → ~250 lines
  (ceiling 300).
- `window-coverage-register.ts` — disposition for each of the 23 registry
  providers (`table-section` 12 / `runtime-published` 4 / `runtime-partial` 2
  / `no-runtime-rows` 4 / `local` 1) + `NO_PUBLISH_GATEWAY_IDS`.
- Four suites: `window-truth-apinex`, `window-truth-bai`,
  `window-truth-router-gaps`, `window-coverage-register` (census + seam
  wiring + spots + inheritance + no-row defaults + fail-closed register lint
  + NEEDS-REVIEW flag persistence).
- `scripts/providers/verify-window-truth.ts` — LIVE no-publish-gateway
  census (apinex keyless; bai via `BAI_API_KEY`, CENSUS-UNAVAILABLE line
  without it).

## Verification (AUDIT)

- Full typecheck (13 workspaces + scripts): exit 0.
- Window-truth battery 45/45; register lint + fallbacks 15/15; ladder suites
  (context-window, fid-0919-016, fid-0919-018, max-output) 25/25 — no stale
  pins.
- `quality:report`: PASS (1,498 baselined files).
- **LIVE probe exit 0** — 14 sampled rows match vendor rosters AND the new
  census: **apinex 34/34 and bai 59/59 live-roster ids registered** (the live
  bai roster is exactly the 41 rows + 18 no-row register). Two pre-existing
  bazaarlink WARNs (glm-5.2/glm-5.1 roster drift) are the designed WARN path.
- `fid:verify --write`: receipt stamped, 12/12 declared gates PASS.
- Completeness batteries: full cli suite **3,868 pass / 18 skip / 0 fail**
  (465 files); full sdk suite **586 pass / 1 skip / 0 fail**.
- `validate:repository`: PASS — after an in-pass hygiene fix of three
  PRE-EXISTING scratchpad-stray issues surfaced by the validator
  (`kiosapi-catalog-probe.ts` + `kiosapi-window-truth-probe.ts` moved to
  `dev/scratchpad/active/` as reusable validation tooling;
  `fluid-cathedral/` moved to `dev/scratchpad/archive/` as a completed
  design-audit working directory). None of the three was created by this
  session; the moves are the validator's own prescribed remediations and
  are invisible to git (scratchpad is gitignored).

## Open items

- T128 stays in `SCOPE.md`: implementation verified; closure + archive +
  CHANGELOG entry await G2 commit authority (T127 precedent).
- T128(f) censuses (66 exactly-200000 rows; 5 zero-row providers:
  cloudflare/ollama/codecraft/xkiro/cleanapis) are registered follow-up
  analysis inside the approved scope — the register records each provider's
  `no-runtime-rows` disposition with the census date.

## Boundaries

- No fresh OpenRouter cross-vote was run (operator-ruled sourcing); ~20 rows
  carry mechanical `NEEDS-REVIEW` flags for single-source provenance.
- No git operations performed (G1/G2) — staging plan prepared for the
  operator.

# Session Summary: 2026-09-28 — T62-followup(1) + T90-F3 closure

**Session ID:** 2026-09-28-t62-followup-t90f3-close
**Status:** completed
**Branch:** `main` (no commit — operator defers push; tree carries the full
2026-09-28 session's uncommitted work)

---

## Initial State

Two remaining level-3 register items after the earlier 2026-09-28 sessions
(rulings: T84-C Option 1, T61 Option A, FID-2026-0928-009 activate, "T90-F3
residual needs no code"):

- **T62-followup(1):** commandcode catalog case-drift
  (`zai-org/GLM-5.2/5.3`) + keyless-roster fail-open boundary — register
  marked "candidate FID, operator call", automation level 3.
- **T90-F3:** the FID-2026-0927-003 step-3 residual (write-boundary
  stale-receipt fatality) — ruled "needs no code"; needed recording,
  closing, archiving.

SCOPE carried 11 open items; `dev/fids/` active queue was empty (all five
2026-0928 FIDs plus -0927-003 already archived… -0927-003 was still active
as the T90-F3 carrier).

---

## Work Completed

### T62-followup(1) — filed, implemented, closed as `FID-2026-0928-010`

RED grounding (all LIVE, 2026-09-28, keyless/read-only; probes retained in
`dev/scratchpad/active/t62f1-*.ts`):

- **F1 case-drift confirmed live:** roster serves `zai-org/GLM-5.2` /
  `zai-org/GLM-5.3` (uppercase); catalog pins lowercase. Casing cross-check
  proves the drift is isolated to the two GLM rows (Kimi/Qwen/deepseek/xai
  all match). The FID-2026-0916-004 CHANGELOG says uppercase — the lowercase
  spellings were a realignment transcription defect that its own test pins
  then embalmed.
- **F1b new source discovered:** the commandcode roster publishes
  `context_length` per id; both GLM rows advertise **1,000,000** — the
  binding (gateway) value, strictly conservative vs upstream votes
  (1,048,576 / 1,310,720, kept in comments).
- **F2 fail-open re-confirmed:** keyless `/models` → HTTP 200, full 82-id
  roster. Vendor-side; documented, not patched. Direct wire proof of case
  sensitivity is operator-key-blocked (no `COMMAND_CODE_API_KEY` locally —
  every probe id 401'd incl. the control).
- **F3 new finding:** `scripts/providers/verify-window-truth.ts` had been
  structurally red since the realign — 4 dead samples (2 pre-realign
  commandcode keys, 2 removed opencode-go rows). The run also caught a
  **genuine** bazaarlink drift on `tokenharbor/deepseek-v4-flash`
  (1,000,000 vs table 1,048,576) — settled LIVE 2-of-3 (orcarouter +
  OpenRouter both 1,048,576): table row upheld, probe sample re-pointed to
  orcarouter.

GREEN (RED-first: new pin suite observed 1 pass / 4 fail pre-change):

- Re-keyed both GLM rows across catalog (`providers.ts`), protocol map
  (`provider-protocols.ts`), fallback table (`context-window-table.ts`);
  windows re-sourced to 1,000,000 with full vote provenance in comments.
- Fail-open boundary documented on the commandcode registry entry + a
  manifest evidence path to the catalog surface (NOT the gitignored probe —
  `validateProviderAudit` fs-checks evidence paths).
- Probe samples repaired; new in-process rot-class pins in
  `window-truth.test.ts` (every sample key must exist as a table row; no
  removed-provider samples). LIVE probe: exit 0, 14/14 rows match.
- Suites updated: realign GLM leg, context-window-fallbacks pin.

Receipt stamped 7/7 LIVE twice (at `fixed`, re-stamped at `closed`);
archived; CHANGELOG entry written under 0.0.34.

### T90-F3 — FID-2026-0927-003 closed per operator ruling

- Ruling recorded verbatim-adjacent in the doc: *"T90-F3 residual needs no
  code"* — repository-only stale-receipt demotion accepted as final; the
  write boundary (`pre-write-gates-fid.ts:105`, `scripts/fid-check.ts:40`)
  stays fatal **by design**.
- *Open Remediation* retitled "ACCEPTED AS FINAL"; Step 3 checkbox flipped
  with the acceptance language; Resolution filled (closure commit hash
  pending G2, recorded as such).
- All 7 declared gates re-run LIVE green; receipt re-stamped; archived;
  CHANGELOG entry written under 0.0.34.

### SCOPE.md

- T90-F3 block removed; T62-followups rewritten (item 1 completed with
  evidence, items 2–3 remain level-1 operator-blocked); count prose
  11→10 (**Ten**), provenance paragraph updated. `scope-register-check`
  PASS; checkbox count verified 10.

### Idea-shelf review + archive folder (operator directive)

- Reviewed all 17 shelf items against reality. Created
  `dev/idea-shelf/archive/` and moved the 4 terminal-state items:
  `savant-logo-easter-egg.md` (implemented, FID-2026-0816-008),
  `utility-tier-duplication-eslint-enforcement-gap.md` (resolved via
  FID-2026-0928-009), `opentui-design-capabilities-reference.md`
  (superseded by the canonical docs/ design doc), and
  `agent-skills-retrofit-deep-research-prompt.md` (realized as the
  self-improving harness, FID-2026-0824-012).
- 13 live items remained after the archive moves; the operator then directed
  the deep-research prompts moved out of the shelf entirely — all 5
  (`auto-drive`, `devvy-integration`, `mcp-search-server`,
  `savant-desktop-chat`, `zero-cost-search`) now live in
  `dev/test-prompts/` (prompts are run, not shelved; none has been run yet).
  8 idea-farm/blueprint items remain on the shelf. Flagged for the operator:
  the desktop-chat DR prompt may predate the shipped `desktop/` workspace —
  verify before any re-run.
- New `dev/idea-shelf/README.md` (purpose, layout, lifecycle,
  conventions, review log) + `archive/README.md` (per-item reasons);
  `dev/README.md` dev-records table gains the archive row and the
  test-prompts row now names deep-research prompts. Closure ritual
  defined: promotion = leave the shelf for FID/SCOPE; terminal = move to
  `archive/`; runnable prompts = `test-prompts/`, not the shelf.

---

## Issues Discovered

1. **`bun run test` executes per-workspace** — cwd-relative
   `process.cwd()` paths in cli tests resolve to `cli/` and ENOENT. The
   full battery caught 3 such failures in my new pins; fixed with
   `import.meta.dir`-relative resolution (5 levels up to repo root) and
   verified under both repo-root and per-workspace invocation.
2. **300-line ceiling friction:** the providers.ts comment initially pushed
   the file to 301; comment compressed.
3. `resources/freebuff-main/` stale copy re-confirmed present (T67 guard
   context; substring-filter hazard when invoking bun test with paths).

---

## Validation Results (full battery, final)

- `bun run typecheck` — PASS (exit 0, all legs incl. typecheck:scripts)
- `bun run test` — PASS (exit 0; 421 pass / 0 fail in final leg; earlier
  3-fail run was the cwd defect above, fixed)
- `bun x eslint . --max-warnings 0` — PASS
- `bun run lint:md` — PASS
- `bunx prettier --check .` — PASS (window-truth.test.ts reformatted)
- `bun run quality:report` — PASS (1498 baselined files)
- `bun run validate:repository` — PASS
- `bun run fid:verify --check` — PASS
- LIVE window-truth probe — PASS (14/14 rows match vendor rosters)

---

## Perfection Loop Summary

| Loop | Target | RED | GREEN | AUDIT | Delta |
|------|--------|-----|-------|-------|-------|
| FID-2026-0928-010 | case-drift + probe rot | LIVE probes + 1/4-fail pin run | re-key + re-source + probe repair, all gates 7/7 | adversarial self-check in FID; closed-world invariants held | 3 data surfaces, probe, registry comment, 3 test files |
| FID-2026-0927-003 close | T90-F3 ruling | n/a (ruling) | doc edits + re-stamp 7/7 | fid:verify --check | record-only |

---

### custats feeds adapter (FID-2026-0928-011, closed + archived)

- Operator directive: add custats as a second discovery source. Filed
  FID-2026-0928-011; RED-first implementation (18/18 pins; pins caught 2
  real defects pre-live); `providers:custats` leg shipped — offers RSS →
  ledger/report (expiry radar), models JSON → enrichment/retirement signal,
  conservative two-mechanism host attribution, soft freshness gates. LIVE:
  43 attributed / 44 unattributed / 1 expiring soon. Receipt stamped 2/2
  (`typecheck scripts` is not a legal gate — policy wall documented in the
  FID; typecheck:scripts leg run green live). FID + shelf item archived;
  CHANGELOG entry under 0.0.34. New lib modules:
  `custats-feed.ts` / `custats-models.ts` / `custats-report.ts`.

## Open Questions / Blockers

- Commit/push remains operator-gated (G1/G2); both closure records cite the
  pending commit hash.
- T62-followup(2)(3): operator credits/keys (tokenharbor free-cell re-run
  window; tokenrouter top-up).
- Wire-level case-sensitivity proof for commandcode needs a keyed probe if
  the operator ever wants severity upgraded from roster-evidence.

## Next Steps

- [ ] Remaining SCOPE items are all operator-blocked (level 1): T94, T83-E,
      T95-B, T95-C, T97, R1, R2, R3, T62-followup(2)(3), T87-B.

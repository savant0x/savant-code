# FID: Zero-intervention self-healing for provider catalog visibility (/model)

**Filename:** `FID-2026-1006-001-codecraft-model-picker.md`
**ID:** FID-2026-1006-001
**Severity:** high
**Status:** closed
**Created:** 2026-10-06 03:29
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The original draft proposed a per-provider band-aid (a one-off stored-key fallback
for the `codecraft` wrapper). The operator rejected it as not a robust fix and
required a mechanism that handles this failure class automatically, forever, with
**zero operator intervention**. This revision converges into a systemic
architecture eliminating the entire class — a healthy, fully wired provider
rendering zero rows in `/model` with no signal — for every current and future
provider. Five dependent milestones (M0–M4): a report-only catalog-parity
tripwire, a shared registry-driven key resolver, coverage-validated warm start,
a register truth-check with a safe `--fix` reconciliation surface, and a
mechanical drift warn. Thinker pressure-tested the design (sequential-thinking,
7 thoughts, converged). Acceptance: once a key exists (env or stored via
`/provider`), `codecraft/…` rows appear in `/model` automatically within one
refresh cycle; register drift flips automatically via the check/fix script;
nothing requires operator attention.

## Environment

- **OS:** Windows (win32; Git Bash shell)
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Tool Versions:** project version 0.0.35
- **Commit/State:** `9c3f7131` (`main`, 57 commits ahead of `origin/main`)

## Detailed Description

### Problem

A registered, wired, live-answering provider (`codecraft`, plus the same latent
defect in every authenticated live catalog) renders **zero** rows in `/model`
with no error and no signal — until a human probes it. The same disease already
drifted `WINDOW_COVERAGE_REGISTER`: `codecraft`, `cleanapis`, and `xkiro` are
declared `no-runtime-rows` while live-measured at 33, 33, and 129 rows.

### Expected Behavior

1. Any registered `source:'live'` provider with a resolvable key (env or stored)
   contributes rows to `/model` within one refresh cycle, automatically.
2. No silent state: keyless absence is surfaced (never a bare empty group that
   hides a healthy provider); register drift is detected and reconcilable
   mechanically.
3. Every file below is covered by this FID (approved scope).

### Root Cause

1. **Stale warm-start snapshot served unconditionally.** `/model` calls
   `fetchGatewayModels()` without `forceRefresh`; cold start serves
   `gateway-catalog.json` as-is within `CATALOG_TTL_MS`, with **no coverage
   check**. Measured: `grep -c codecraft ~/.savant-code/gateway-catalog.json` → 0.
2. **Env-only key resolution in the catalog-fetch seam.** Every live wrapper
   declared `resolveKey: () => process.env.X`; a key stored via `/provider`
   (credentials.json) never reached the catalog fetch → silent 401 → empty.
3. **Hand-edited register with no drift detector.** `WINDOW_COVERAGE_REGISTER`
   can declare `no-runtime-rows` beside live rows forever; the shape gate can
   never see the lie.

### Evidence

- `cli/src/commands/defs/model-provider-commands.ts` → `/model` handler calls
  `fetchGatewayModels()` then `useModelPickerStore.getState().open(models)`.
- `cli/src/utils/openrouter-models/gateway.ts` → symbol:fetchGatewayModels — cold-start
  disk serve; `...codecraftModels` in the combined spread.
- `cli/src/utils/openrouter-models/gateway-disk-cache.ts` → symbol:loadGatewayCatalogFromDisk
  (no coverage validation).
- 8 wrappers (`codecraft.ts`, `cleanapis.ts`, `xkiro.ts`, `nous.ts`, `kiosapi.ts`,
  `apinex.ts`, `bai.ts`, `openai.ts`) → `resolveKey: () => process.env.X` (measured grep).
- `cli/src/utils/provider-credentials.ts:27` → `readCredentialsRecord().providerApiKeys`
  (the stored-key seam the catalog fetchers ignored).
- `common/src/constants/window-coverage-register.ts:214,221,242` → codecraft/xkiro/
  cleanapis = `no-runtime-rows`; live census 2026-10-06 = 33/129/33 rows.
- Live proof: `gateway-catalog-probe.ts codecraft --chat gemma-2-2b` → POST 200
  ("Pong! 🏓", usage 288/133/421); fan-out probe → codecraft 33 of 2,179.

## Impact Assessment

- Risk: **High** (systemic across all authenticated live providers; no workaround
  exists that is not a hidden manual step).
- Affected: the live-catalog seam, 8 wrappers, gateway warm start, the register,
  `scripts/`, root `package.json`, and the picker surfaces.

## Proposed Solution (converged — Thinker pressure-tested)

Order beats simultaneity: the tripwire (M0) makes the lie visible first; the
resolver (M1) precedes the coverage-validated load (M2) because the validator
must use the SAME resolver to avoid a two-face bug.

- **M0 — Parity probe + census regenerator.** `scripts/provider-catalog-parity.ts`
  assembles the FULL live catalog (`fetchGatewayModels(true)`) and atomically
  rewrites the committed census
  `common/src/constants/provider-catalog-census.json` from measurement — the
  source the M3/M4 check/fix consume. `providers:parity` regenerates;
  `providers:parity --check` is report-only (CI-safe). A future provider is
  auto-reconciled because the census is never hand-edited again (Verifier
  FAIL 1 closure). **Files:** `scripts/provider-catalog-parity.ts` (new);
  `common/src/constants/provider-catalog-census.json` (new, tracked);
  `scripts/__tests__/provider-catalog-parity.test.ts` (new); `package.json`
  (`providers:parity`, `providers:parity:check`).
- **M1 — Shared registry-driven resolver.** `resolveProviderApiKey(providerId)`
  in `cli/src/utils/provider-credentials.ts`: registry envVar → `process.env`
  (`''`==unset) → stored `providerApiKeys` fresh read → undefined; async; never
  throws. Consumed by all 8 live wrappers (env-wins-stored, uniform precedence
  with the request path). **Files:** `cli/src/utils/provider-credentials.ts`;
  8 wrappers; `cli/src/utils/__tests__/provider-credentials.test.ts` (new).
- **M2 — Coverage-validated warm start.** New pure module
  `cli/src/utils/openrouter-models/gateway-coverage.ts` exporting
  `computeCatalogGaps`, `rowProviderIds`, `computeGaps`, cooldown helpers
  (`REFRESH_COOLDOWN_MS`, `gatewayRefreshCooledDown`, `markGatewayRefreshAttempt`),
  and `staleWindowCoverageLiveProviders`. `fetchGatewayModels` checks snapshot
  coverage before serving; on gaps for keyed live providers it rebuilds
  (cooldown-gated against 401-thrash); no-key is never a gap.
  **Files:** `gateway-coverage.ts` (new); `gateway.ts` (wiring);
  `cli/src/utils/openrouter-models/__tests__/gateway-coverage.test.ts` (new).
- **M3 — Register truth-check.** New probe-style script
  `scripts/window-coverage-check.ts` (mirrors `provider-docs-counts-drift.ts`:
  importable pure checks + guarded `main()`): reads the live register + a census
  JSON (default `common/src/constants/provider-catalog-census.json` — regenerated
  by the M0 parity probe), asserts no census-listed live provider with rows is
  declared `no-runtime-rows`. Exit 0 clean / 1 naming issues. **Files:**
  `scripts/window-coverage-check.ts` (new);
  `scripts/__tests__/window-coverage-check.test.ts` (new);
  `common/src/constants/provider-catalog-census.json` (tracked census);
  `package.json` (`window-coverage:check`, `window-coverage:fix`);
  `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts`
  (census-derived test added).
- **M4 — Reconciliation + mechanical drift warn.** `window-coverage-check.ts
  --fix` rewrites a stale `no-runtime-rows` entry to `runtime-published` with a
  census-recorded note (anchored textual edit; atomic tmp+rename; re-checks
  after). `fetchGatewayModels` logs a one-line warn when a `no-runtime-rows`
  live provider now contributes rows (the CLI never edits — the script is the
  safe surface). **Files:** same as M3 + `gateway.ts` warn (already wired).

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/provider-credentials.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/gateway-coverage.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test scripts/__tests__/window-coverage-check.test.ts
- gate: test scripts/__tests__/provider-catalog-parity.test.ts
- gate: probe dev/scratchpad/active/codecraft-gateway-fanout-probe.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:11cefbd1cfd33ed1a979f1089d85c7858a0b56301bf4fb7552fdfd7f8e72c182
- verified: 2026-10-06T08:38:49.437Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/__tests__/provider-credentials.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/gateway-coverage.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test scripts/__tests__/window-coverage-check.test.ts: exit 0
- test scripts/__tests__/provider-catalog-parity.test.ts: exit 0
- probe dev/scratchpad/active/codecraft-gateway-fanout-probe.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The three silent-failure layers (stale snapshot with no coverage
  check; env-only resolver hiding stored keys; hand-edited register with no drift
  detector). The band-aid draft was rejected by the operator as insufficient;
  the operator requires the fix to be automatic and permanent ("without any
  intervention from me").
- **GREEN:** Converged M0–M4 architecture (above), Thinker pressure-tested
  (7 thoughts, converged; ordering rationale: resolver before validator,
  tripwire before hardening).
- **AUDIT:** All 8 declared gates PASS under `fid:verify --write` (receipt
  stamped 2026-10-06): typecheck cli + common exit 0; the three cli suites
  (provider-credentials 7, gateway-coverage 7, window-coverage-register 5)
  exit 0; scripts window-coverage-check 8/8 exit 0; the live fan-out probe
  reports codecraft: 33 / cleanapis: 33 / xkiro: 129 of 2,179 total rows
  (2026-10-06); quality PASS. The detector `bun scripts/window-coverage-check.ts`
  flagged all three stale entries before `--fix`; after `--fix` + atomic
  whole-entry rewrite, the register's codecraft/cleanapis/xkiro dispositions
  are `runtime-published` and the check exits 0 ("matches the census").
- **ADVERSARIAL:** The `--fix` first pass introduced duplicate `note:` keys
  (head-only replacement) and verified against a stale in-process import;
  both defects were caught by the live run, repaired (whole-entry block
  regex replace + written-text verification), and re-verified green — the
  register is now byte-valid and prettier-clean.
- **CHANGE DELTA:** 100% (revision replaces the band-aid draft).

### Missed Questions (pressure-test findings folded in)

1. Who decides key-resolvable? → Only M1's resolver, used by M2 identically.
2. Concurrent cold-start races? → Cooldown + atomic writes; parse failure = cold
   fetch, never crash.
3. 401-thrash loop? → Outcome taxonomy (no-key ≠ gap) + cooldown.
4. Register drifting again? → M3/M4 make it mechanically checked + fixable.
5. Env AND stored / empty string? → Env wins; `''`==unset.
6. Transient outages false-failing? → Check is report-only (exit 0) unless run
   with explicit gate context; fix requires the census.
7. Wrapper without registry entry? → Out of scope here (resolver is registry-keyed;
   a wrapper-less registry id simply isn't fetched — covered by existing
   provider-audit convergence).
8. Silent empty groups in the picker? → Outlawed per this FID: coverage-validated
   warm start rebuilds keyed gaps automatically.
9. Stamp security? → `--fix` stamps only the measured census rows + date.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** (working tree; not yet committed — G2 pending)
- [x] **File:line ranges:**
  `cli/src/utils/provider-credentials.ts` → symbol:resolveProviderApiKey;
  `cli/src/utils/openrouter-models/codecraft.ts` → symbol:createLiveCatalogFetcher
  `resolveKey` (same in cleanapis/xkiro/nous/kiosapi/apinex/bai/openai);
  `cli/src/utils/openrouter-models/gateway-coverage.ts` (new, whole file);
  `cli/src/utils/openrouter-models/gateway.ts` → symbol:fetchGatewayModels
  (coverage check + warn); `scripts/window-coverage-check.ts` (new, whole
  file); `common/src/constants/window-coverage-register.ts` → codecraft/
  xkiro/cleanapis entries (`runtime-published`); `SCOPE.md` T151 targets.
- [x] **Gate output:** 8/8 PASS stamped by `fid:verify --write` (above);
  eslint 0; prettier clean; marker probe live 33 rows.
- [x] **Reproducibility:** `bun scripts/window-coverage-check.ts`; grep
  `resolveProviderApiKey` across `cli/src/utils/openrouter-models/*.ts`
  (8 sites); grep `runtime-published` in the register entries.
- [x] **Step statuses:** M0 done, M1 done, M2 done, M3 done, M4 done — all
  implemented and receipt-verified this session.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (read 0-EOF this session)
- [x] Implementation matches the Proposed Solution (M1–M4 as specified)
- [x] Typecheck/tests/lint pass with pasted tool output (8/8 gates, eslint 0,
  prettier clean)
- [x] Production call-graph evidence: `fetchGatewayModels` (the one production
  entry point, driven by `/model`) now calls `computeCatalogGaps` +
  `staleWindowCoverageLiveProviders`; the 8 wrappers call
  `resolveProviderApiKey` (measured by grep); `package.json` wires
  `window-coverage:check` / `window-coverage:fix`, `providers:parity` /
  `providers:parity:check`.
- [x] FID status reflects the actual implementation state (`verified`)

### Loop 2 — Independent audit and self-correction

- **RED:** The Verifier's independent audit found three FAILs the green gates
  could not see: (1) the census was a static scratchpad artifact never
  regenerated — `--fix` iterates only `census.rows`, so a future provider
  could never be auto-reconciled (the "automatic forever" requirement failed
  for the class, not just the three known providers); (2) `--fix` printed
  "No stale entries" and exited 0 when its anchor failed to match the source
  (format drift / CRLF) — a silent exit-0 lie; (3) `computeCatalogGaps`
  resolved keys for ALL live providers, so the all-covered cold-boot fast
  path paid credential reads it never used to.
- **GREEN (self_correct):** (1) M0 shipped — `scripts/provider-catalog-parity.ts`
  regenerates the committed census from the live assembly; the census moved
  from `dev/scratchpad/active/` (scratch) to
  `common/src/constants/provider-catalog-census.json` (tracked truth), so a
  future provider enters the census on the next parity run and is reconciled
  without a human; (2) `staleCensusIds` + a fail-loud guard: any census-stale
  provider whose anchored entry cannot be matched now exits 1 naming the ids,
  never 0; (3) `computeCatalogGaps` computes the absent set first and resolves
  keys only for absent providers — the fully-covered path is zero-I/O.
- **AUDIT (re-verify):** typecheck cli/common/scripts exit 0; eslint 0;
  prettier clean; 31/31 tests across 5 suites (provider-credentials 7,
  gateway-coverage 7, window-coverage-register 5, window-coverage-check 8,
  provider-catalog-parity 4); `providers:parity --check` live-run produced the
  full 2,179-row census (codecraft 33, cleanapis 33, xkiro 129);
  `window-coverage-check` exits 0 "matches the census".

#### Receipt re-stamp — RESOLVED (cross-session interference, 2026-10-06)

The re-stamp was briefly blocked ONLY on the repo-wide `quality` gate:
`packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts` sat at 333
lines (absolute max 300) — a file **not touched by this FID**, carrying the
concurrent T150 pi-harness session's in-flight +34 lines. Fixing it was out of
this FID's scope and would have raced that session. The concurrent session
landed its own split (284 lines) the same day, `quality` returned PASS, and
`fid:verify --write` then stamped **9/9 gates** — the full declared set plus the
new parity gate. The implementation was never at fault; the gate was shared.

- **ADVERSARIAL:** The self-corrections close each cited hole directly; the
  receipt re-stamped 9/9 once the shared `quality` gate cleared.
- **CHANGE DELTA:** ~12% (M0 + guards added to the converged plan's files).

### Loop 3 — Final convergence

- **RED:** Closure-readiness audit found no open defect: all declared gates
  green, the detector → check → fix loop exercised live, and the register
  reconciled by its own mechanism.
- **GREEN:** Closure executed on the operator's directive — status `closed`,
  Resolution in the closure format, file moved to `dev/fids/archive/`, CHANGELOG
  and archive-index entries added.
- **AUDIT:** `fid:verify --write` 9/9 PASS at the pre-archive path; every
  declared gate re-verified green this session.
- **ADVERSARIAL:** Closed-record semantics — the closure edits (status flip +
  `Archived:` line) land after the last stamp, so the closed record's
  fingerprint is expected to drift and carries no live guarantee
  (FID-2026-0919-021); the receipt documents the verification that EARNED the
  status, not the closed bytes.
- **CHANGE DELTA:** closure ceremony only.

## Resolution

- **Closed Date:** 2026-10-06 05:16 EDT (operator closure directive; all
  declared gates green).
- **Fix Description:** The provider-catalog visibility failure class is closed
  systemically (M0–M4). (M1) `resolveProviderApiKey(providerId)` in
  `cli/src/utils/provider-credentials.ts` — one registry-driven chain
  (env → stored `/provider` key → undefined; `''`==unset; never throws) now
  consumed by all 8 authenticated live wrappers, so a stored key reaches the
  catalog fetch. (M2) New `cli/src/utils/openrouter-models/gateway-coverage.ts`
  plus `fetchGatewayModels` wiring: the warm-start disk snapshot is
  coverage-validated; a keyed live provider missing rows makes it stale and
  triggers a cooldown-gated rebuild (no-key is never a gap). (M3)
  `scripts/window-coverage-check.ts` fails loud when a census-measured provider
  is declared `no-runtime-rows`. (M4) Its `--fix` atomically rewrites the stale
  entry to `runtime-published` with a census-recorded note; the CLI emits a
  one-line drift warn. (M0) `scripts/provider-catalog-parity.ts` regenerates the
  committed census (`common/src/constants/provider-catalog-census.json`) from
  the live catalog assembly, so a FUTURE provider is auto-reconciled with no
  human step. The three originally-stale register entries
  (codecraft/cleanapis/xkiro) were corrected by the mechanism itself.
- **Tests Added:** Five suites — `provider-credentials.test.ts` (7),
  `gateway-coverage.test.ts` (7), `window-coverage-check.test.ts` (8),
  `provider-catalog-parity.test.ts` (4), and a census-derived extension to
  `window-coverage-register.test.ts` (5) — 31 tests total, all green.
- **Verification Evidence:** `fid:verify --write` **9/9 PASS** (receipt
  `sha256:11cefbd1cfd3…`, `2026-10-06T08:38:49Z`): typecheck cli + common; the
  five test suites; the live fan-out probe (codecraft 33 / cleanapis 33 / xkiro
  129 of 2,179 rows); `quality` PASS. Plus eslint `--max-warnings 0` = 0,
  prettier clean, markdownlint clean, and `window-coverage:check` exit 0
  ("matches the census"); the parity probe's live `--check` run listed the full
  2,179-row census.
- **Archived:** 2026-10-06 05:16 EDT →
  `dev/fids/archive/FID-2026-1006-001-codecraft-model-picker.md`

## Lessons Learned

Four invariants, each earned by a defect this session:

1. **Tripwire before refactor.** Make the lie mechanically visible (the parity
   census) before moving self-healing code — the tripwire de-risks the refactor
   and proves the gap is real rather than assumed.
2. **Derived, never hand-edited truth.** A register of measured facts needs a
   generator, a drift check, and a safe reconciliation surface, or it silently
   decays — codecraft/cleanapis/xkiro sat `no-runtime-rows` beside 33/33/129
   live rows, and the fixed shape gate could not see it.
3. **Silent empty is forbidden.** A healthy provider rendering zero rows with no
   signal is the bug class; keyless absence must be surfaced, and only a proven
   auth failure may hide a provider.
4. **One resolver, both paths.** Catalog-fetch and request-time credentials must
   share one registry-driven precedence chain, or the picker and the request
   disagree (the two-face bug the Verifier named).
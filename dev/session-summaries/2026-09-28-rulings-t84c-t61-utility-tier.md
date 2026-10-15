# 2026-09-28 — Rulings executed: T84-C Option 1, T61 Option A, utility-tier FID activated

**Governance:** ECHO Protocol v0.1.2-single-agent, `strict_mode: true`, session
autonomy level 3. Continuation of the same working tree; no commits (operator
directive: "we're going to push later but we're finishing all the work first").

**Rulings received:** "1, 2.a, 3. activate" — T84-C → Option 1 (extend the
standing gate), T61 → Option A (dual-credential seam, then flip),
FID-2026-0928-009 → activate now; commit deferred.

## T84-C Option 1 — implemented (FID-2026-0928-007, closed, archived)

- `scripts/tsconfig.json` include widened to `["**/*.ts"]`; the
  `typecheck:scripts` hard-gate leg now compiles the entire tree. Probe
  config deleted (obsolete).
- 36 → 0 errors, by class: A (8 production defects — `durationMs` typed in
  `audit-evidence.ts`'s `run()`; `signalCode ?? null` normalization in
  `fid-verify.ts`; `lastSeenUtc` in `candidates-io.ts`'s read cast;
  `Partial<Pick<…>>` fail-open signature for `shouldReprobeUnverifiable`;
  `lastProbe` narrowing in `propose-provider.ts`); B (all 8 `buildReceipt`
  calls pass `VERIFIED_AT`); C (typed fixture annotations, `as const`
  decisions, explicit fetch-double boundary casts, parameter-typed probe-pool
  fake); D (`provider-stamp.ts` rewritten as the canonical-typed seam).
- The probe tool's own measure: 86 tests across the 8 touched suites, 0 fail.

## T61 Option A — implemented (FID-2026-0928-008, closed, archived)

- `ProviderSetupInfo.extraEnvVars?` added; `deriveSetupConfig` populates it
  from `credentials.extra`. Cloudflare `setupAvailable: true` (registry test
  count pin 18 → 19).
- `saveProviderApiKeyExtra` persists extras under their own env-var names
  (0600 store); persistence/application logic factored into
  `persistProviderKey`/`activateProviderRouting` (Law 13);
  `applyPersistedProviderApiKeys` applies extras at run start.
- Multi-step prompt flow: `beginProviderSetup` stages extras (skipping
  shell-satisfied ones); `routeKeySetup` gained `getNextInputMode`
  (post-save) and `emptyValueMessage` hooks; the masked-key router chains
  token → account id → completion message.
- The provider-exception audit gate caught the now-stale cloudflare
  `setup-exclusion` manifest entry live — removed (the gate works).

## FID-2026-0928-009 — implemented and closed (archived)

- Part 4 sweep first: canonical homes (`isRecord` → `common/util/object.ts`,
  `sha256`/`sha256Hex` → new `common/util/hash.ts`, `asOptional*` → new
  `cli/src/utils/openrouter-models/wire-guards.ts`, `sleep` →
  `common/util/promise.ts` typed `Promise<void>`). All shim copies deleted;
  genuinely-different predicates renamed (`isJSONObjectRecord`,
  `isPrimitiveRecord`, `isJSONRecord`, `withTimeoutValue`) rather than
  forced into the general home. Final counts: one body per primitive.
- Parts 1+2+3: `no-duplicate-shared-primitive.js` + `shared-primitives.json`
  registry, wired active in the pre-push eslint leg; 5 fixture-backed pins
  (fires / owner-exempt / test-exempt / local-binding-exempt / registry
  integrity). Negative probe confirmed firing before the pins were written.
- The rule's first full-repo run caught 7 stragglers the greps missed;
  each dispositioned explicitly (clean-process attestation independence is
  contract → allowedFiles, not duplication).
- Part 5: harvest-inheritance note in the rule header.

## Incidents and corrections (honest record)

- **The 300-line ceiling caught my own edit:** adding `VERIFIED_AT` pushed
  `fid-verify.test.ts` to 308 lines, reding `quality:report` and two C3
  re-runs. Fixed by compaction (two comment blocks, one over-constructed
  assertion) → 297 lines. The gate policing its own gate-fixture is a
  pleasing recursion, but the lesson stands: an edit that adds lines to a
  300-line-adjacent file must budget for the ceiling.
- **My first rule draft had a real matching bug:** `allowedFiles` stored
  repo-relative paths while ESLint reports absolute, so the exemption set
  never matched on Windows — the rule flagged files it should have exempted.
  Caught by running the rule repo-wide before declaring done (the negative
  probe alone would not have caught it). Fixed with a boundary-aware
  end-of-path match; noted here because "wired and green" and "wired and
  correct" are different claims.
- **`prettier --write .` reformatted 23 files** I had touched with manual
  edits (sed heredocs during the sweep); the format gate passed only after
  the repo-wide write. The earlier session's method note (edit tools, not
  shell heredocs) was violated again mid-sweep — the gates caught the drift,
  not my discipline.
- The `-009` grep-count table in the filed record (pre-sweep counts) is now
  historical; post-sweep counts are in its Resolution.

## Gates at session end

`bun run typecheck` OK · `bun run test` OK (all workspaces, 728 tests at
last full count) · `eslint . --max-warnings 0` OK · `lint:md` OK ·
`prettier --check .` OK · `quality:report` PASS · `validate:repository` PASS ·
`fid:verify --check` — re-run below with the three new archives.

## Records disposition

Closed + archived: `FID-2026-0928-007` (-007, T84-C), `-008` (T61), `-009`
(utility tier) — receipts re-stamped at closure for byte-consistency.
Active queue: `FID-2026-0927-003` only (its step-3 write-boundary residual
remains operator-blocked per T90-F3). SCOPE register: 13 → 11 open items.
CHANGELOG: three closure entries under 0.0.34. Commit deferred to the
operator (push planned later, per directive).

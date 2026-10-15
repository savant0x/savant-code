# FID: T84-C triage — the `scripts/**` type boundary: 36 errors across 14 files, and three fix shapes

**Filename:** `FID-2026-0928-007-t84c-scripts-type-boundary-triage.md`
**ID:** FID-2026-0928-007
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 1 (the disposition IS the operator ruling; the triage is this record)

---

## Summary

The register line (T84-C) claimed `36 errors across 14 files` in `scripts/**`
outside the release engine, and recorded that two reproduction attempts had
failed on a tsconfig error (`TS5102: Option 'baseUrl' has been removed`),
leaving the figure **unreproducible and a claim, not a measurement**.

**This record reproduces the number exactly — 36 errors, 14 files, same
distribution — and explains why earlier attempts failed.** The `TS5102` was an
invocation artifact: running `tsc` against a probe config that
`"extends": "../tsconfig.json"` **from inside the `scripts/` directory** makes
TypeScript resolve the parent relative to the compiler's cwd semantics rather
than the config's own directory, dropping `baseUrl` before it is read. Run
from the repo root (`bun x tsc -p scripts/tsconfig.probe.json`), the same
probe config compiles cleanly past config load and produces the measurement.

The measurement is now grounded, every error is categorized, and the decision
this record exists for is the operator's: **which fix shape adopts the
untyped tree.** Three are offered below, with a recommendation.

## Environment

- Repo: `savant-code` v0.0.34, `main`, Bun 1.3.14, TypeScript 5.5.4 (repo-pinned).
- The covered surface: `scripts/tsconfig.json` `include` covers
  `public-release.ts`, `public-release/**`, `public-release*.test.ts`, and
  `__tests__/pre-audit.test.ts` + `__tests__/public-release-npm-guards.test.ts`
  — the release engine, typed by the `typecheck:scripts` leg (SCOPE T84-B).
- The probe instrument: `scripts/tsconfig.probe.json` (extends
  `scripts/tsconfig.json`, `include` widened to the whole `scripts/**` tree).
  Kept on disk so the measurement is re-runnable with one command; it is NOT
  wired into any gate.
- Invocation used: `bun x tsc --noEmit -p scripts/tsconfig.probe.json` from
  the repo root. Exit 2, 36 primary errors.
- Covered-surface control: `bun run typecheck:scripts` exits 0 — the boundary
  the release engine already satisfies holds.

## The measurement (2026-09-28, reproduced)

36 errors, 14 files:

| File | Errors | Class |
|---|---|---|
| `scripts/__tests__/fid-verify.test.ts` | 8 | stale arity (B) |
| `scripts/providers/__tests__/discovery-seams.test.ts` | 5 | test fixtures vs shared types (C) |
| `scripts/providers/__tests__/probe-pool.test.ts` | 4 | test doubles + implicit any (C) |
| `scripts/audit-evidence.ts` | 4 | real defect (A) |
| `scripts/providers/lib/provider-stamp.ts` | 2 | **drifted import — dead file** (D) |
| `scripts/providers/__tests__/report-stable.test.ts` | 2 | test fixtures vs shared types (C) |
| `scripts/providers/__tests__/probe-boundary.test.ts` | 2 | fetch-seam double (C) |
| `scripts/providers/__tests__/pipeline-integrity.test.ts` | 2 | fetch-seam double (C) |
| `scripts/audit-evidence.test.ts` | 2 | readonly-array fixture (C) |
| `scripts/providers/propose-provider.ts` | 1 | loose record indexing (A) |
| `scripts/providers/lib/harvest-phases.ts` | 1 | conditional spread widening (A) |
| `scripts/providers/lib/candidates-io.ts` | 1 | inferred record key mismatch (A) |
| `scripts/providers/__tests__/intelligence-layer.test.ts` | 1 | null-narrowing in test (C) |
| `scripts/fid-verify.ts` | 1 | `undefined` vs `null` at a boundary (A) |

By TS code: TS2345 ×10, TS2554 ×8, TS2352 ×4, TS7006 ×3, TS2353 ×3,
TS2339 ×3, TS2724 ×2, TS2322 ×2, TS18047 ×1.

Full compiler output is preserved verbatim in the session summary for
2026-09-28 (`dev/session-summaries/`).

## The taxonomy

### Class A — real type defects in production scripts (8 errors, 4 files)

| Location | Error | Substance |
|---|---|---|
| `scripts/audit-evidence.ts:127,154,168` | TS2353 `durationMs` not in the transcript object type | The evidence transcript builder writes a field its own declared shape does not carry — the type lags the code. |
| `scripts/audit-evidence.ts:225` | TS2339 reading `durationMs` | Same lag, read side: the field is written, then read, and the type says it cannot exist. |
| `scripts/fid-verify.ts:174` | TS2322 `string \| undefined` → `string \| null` | `spawned.signalCode` is `string \| undefined`; the `RunResult` contract says `string \| null`. Bun's own API is `undefined`-shaped; the local type said `null`. |
| `scripts/providers/lib/candidates-io.ts:102` | TS2339 `lastSeenUtc` on the inferred entry shape | The audit-trail merge initializes a record with `lastSeenUtc` but the value type was inferred from an earlier `set` that omits it. |
| `scripts/providers/lib/harvest-phases.ts:66` | TS2345 `CandidateState \| {}` → `Pick<…>` | A conditional spread produces `{}` in one branch; the `Pick<>` requires two fields. |
| `scripts/providers/propose-provider.ts:43` | TS2339 `modelsCount` on `{}` | Loose record indexing downstream of the same widening idiom. |

### Class B — stale arity at the receipt seam (8 errors, 1 file)

`scripts/__tests__/fid-verify.test.ts` calls `buildReceipt(FID, probeResult)`
with **2 arguments at 8 call sites**; the signature
(`buildReceipt(content, results, verifiedAt)`) grew a third required argument
at some point after the test was written. **The suite still passes at runtime**
(bun's transpiler does not check arity), so every receipt the suite asserts on
is built with `verifiedAt: undefined` — the test verifies receipts that
production never builds. This is the sharpest finding in the record: the
test's assertions are materially weaker than they read, and the covered leg
stays green only because the file sits outside the covered include (see
*An apparent paradox, resolved* below).

### Class C — test-fixture friction against shared types (20 errors, 8 files)

- **Fetch-seam doubles (TS2352 ×4, +2 in probe-pool):** the `typeof fetch`
  cast pattern. Since TS 5.x, `fetch` carries `preconnect`, so
  `() => Promise<Response>` no longer overlaps `typeof fetch` and every
  double needs `as unknown as typeof fetch` (or an explicit preconnect
  member). The register's T84-C prose already named "their own
  `typeof fetch` seams and their own double-assertion casts" — confirmed
  exactly.
- **Discovery fixtures (TS2345 ×5):** `discovery-seams.test.ts` feeds
  `{ source: string }` catalogs and a bare `Record<string, unknown>` into
  `CustomProviderConfig`-typed seams. The fixtures predate the discriminated
  union; the tests exercise real shapes but type them loosely.
- **Report fixtures (TS2345 ×2), implicit anys (TS7006 ×3), a void-return
  double (TS2322), one null-narrowing miss (TS18047):** ordinary fixture
  debt, same class.

### Class D — drifted import in a production-dead file (2 errors, 1 file)

`scripts/providers/lib/provider-stamp.ts` imports `type DiscoveryStamp`
from `common/src/providers/discovery-stamp` — **which has no such export**
(the canonical type is `ProviderStamp`; the compiler even suggests it).
Grep reachability: the ONLY importer of `provider-stamp` in the entire repo
is its own test (`discovery-seams.test.ts`). Its docstring claims to serve
"the wizard finalize path" — no such call site exists. The file is dead code
carrying a drifted contract, and its errors are invisible to every gate
precisely because no gate covers this tree.

**Law 13 rider (in scope, same pass per the protocol):** the dead file's
local `writeStamp()` also hand-rolls the stamp fields
(`source: 'discovery-pipeline', acceptedAt`) instead of calling the canonical
`withDiscoveryStamp()` it sits beside. Today the two happen to agree; nothing
stops the next edit to the canonical stamp from silently diverging the dead
copy. If the disposition keeps the file, the fix is deletion of the local
body in favor of a re-export; if the disposition deletes the file, the rider
dissolves.

## An apparent paradox, resolved

`scripts/__tests__/fid-verify.test.ts` is inside the covered
`typecheck:scripts` include, yet the covered leg exits 0 while the probe
reports 8 errors in that same file. Explanation: the covered
`scripts/tsconfig.json` include list does **not** actually compile
`__tests__/fid-verify.test.ts` — the include entry
`__tests__/pre-audit.test.ts` + `__tests__/public-release-npm-guards.test.ts`
is exhaustive over `__tests__`, and `fid-verify.test.ts` is pulled in only
when the probe's `**/*.ts` sweep reaches it. The "release engine typed" claim
holds for what it includes; `fid-verify.test.ts` was never in it. The
boundary is narrower than the register line assumed — which is exactly why a
probe rather than an argument was needed.

## Root Cause

`scripts/` is the only major tree with no standing type gate: it is not a
workspace in `VALIDATION_WORKSPACE_POLICY` (its `scripts/tmux` entry is
explicitly `requiredTypecheck: false`), so the release-engine tsconfig grew a
closed include list and everything else grew up untyped. The `TS5102` that
made earlier reproductions fail was an invocation artifact (config-extension
resolution relative to cwd), not a repo defect.

## Impact Assessment

- No gate covers the untyped surface, so all 36 errors are invisible to CI,
  the pre-push hook, and `validate:repository` — the same class T84-B fixed
  for the release tree.
- Runtime risk today is concentrated in Class A: `audit-evidence` writes a
  field its type denies (works only because nothing type-checks the write),
  and the `fid-verify` receipt suite verifies receipts built with
  `verifiedAt: undefined`.
- Class D is dead code with a drifted contract — zero runtime reach, but a
  standing trap for the next importer.

## Proposed Solution — the operator ruling this record requests

**Option 1 — Extend the standing gate (recommended).** Replace the closed
include list in `scripts/tsconfig.json` with the full tree
(`**/*.ts` + subdirs), fix the 36 errors in their classes
(A: repair the types at the boundaries — transcript type gains `durationMs`;
`signalCode` null-shape aligned; candidates-io/harvest-phases narrow their
records. B: update the 8 stale `buildReceipt` calls. C: `as unknown as
typeof fetch` at the fetch seams + typed fixture literals. D: delete
`provider-stamp.ts` or reduce it to a re-export of the canonical module),
then `scripts` joins the standing `typecheck:scripts` leg permanently —
`quality:report`'s 300-line and the pre-push lint already sweep the tree;
types would finally match. Blast radius: the fix touches ~14 files, none of
which is on the release path except `fid-verify.ts:174` (one-line null-shape
alignment).

**Option 2 — The probe becomes the gate, tree stays as-is.** Keep the
include list closed but add the probe config as a *reporting* leg
(non-blocking) so the number is watched rather than discovered. Cheapest,
but institutionalizes the debt and leaves Class A unfixed.

**Option 3 — Shrink to typed.** Keep the boundary closed; fix only Class A
(the 8 production-script errors) and delete Class D; leave the test-fixture
friction (Class C) untyped until it next bites. Middle cost, loses the
fixture protection.

**Recommendation:** Option 1. Class B alone justifies it — a verification
suite that never passes `verifiedAt` is verifying a fiction, and that suite
backs the FID receipt mechanism this repository runs on. The C-class work is
mechanical; the D-class file should go regardless of the option chosen.

Because this record changes no code, the gates verify that the tree is as
described: the covered surface stays green, the stale-arity suite passes at
runtime *while its file carries type errors* (the record's sharpest claim,
pinned live), and repo quality holds.

## Verification Gates

- gate: test scripts/__tests__/fid-verify.test.ts
- gate: test scripts/__tests__/pre-audit.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:166347e5120b9f0d9686dd459e4317e4574677f25483eae90f70106e3a35ea7e
- verified: 2026-09-28T20:53:13.369Z
- test scripts/__tests__/fid-verify.test.ts: exit 0
- test scripts/__tests__/pre-audit.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Read `scripts/tsconfig.json`, root/base tsconfigs, validation policy
- [x] Build the probe config; reproduce the 36/14 measurement from repo root
- [x] Explain the earlier TS5102 reproduction failure (cwd/config resolution)
- [x] Categorize all 36 errors into classes A–D with file:line
- [x] Reachability: `provider-stamp` importers, `audit-evidence` consumers,
      `buildReceipt` signature vs its suite
- [x] Confirm the covered include does NOT reach `fid-verify.test.ts`
- [x] Draft the three fix shapes + recommendation
- [x] Operator ruling on the fix shape — received 2026-09-28: **Option 1**
      (extend the standing gate), per the operator's message "1, 2.a, 3.
      activate" answering the three pending records in order

## Perfection Loop

### Missed Questions

1. **Why trust this 36-error count when the register did not trust the last
   one?** Because the failure mode is identified and removed: the TS5102 was
   cwd-dependent config resolution, reproduced by running the identical
   config from a different directory. The measurement in this record carries
   its exact invocation so the next reproduction cannot fail the same way.
2. **Should the probe config be deleted after the ruling?** Under Option 1 it
   becomes obsolete (the main include widens past it) and should be removed;
   under Option 2 it becomes the gate; under Option 3 it stays as the
   measurement instrument. The disposition determines its fate — deleting it
   now would destroy reproducibility before the ruling.
3. **Is class B really a defect if bun passes the suite?** Yes — the
   contract `buildReceipt(content, results, verifiedAt)` is a verification
   contract of this repository's FID mechanism, and a suite that exercises
   it with `verifiedAt: undefined` verifies a receipt shape production
   cannot emit. Runtime-green under a transpiler that skips arity checks is
   the absence of a gate, not the presence of correctness.
4. **Does fixing class A change runtime behavior?** No — every class A error
   is a type-level mismatch on values the code already produces correctly
   (the `durationMs` writes are real and must be typed, not removed); the
   one behavioral candidate (`fid-verify.ts:174`) is a type-shape alignment
   on a `null`/`undefined` the runtime already handles.

### Code Verification Evidence

- [x] Measurement reproduced from the repo root with the invocation recorded
      in Environment; exit 2 with exactly 36 primary errors across 14 files
- [x] Covered-surface control holds: `bun run typecheck:scripts` exits 0
- [x] The paradox file verified: `scripts/__tests__/fid-verify.test.ts` is
      not matched by the covered include list, and the covered leg exits 0
- [x] Reachability: `provider-stamp.ts` has exactly one importer (its own
      test); `audit-evidence.ts` is consumed by `audit-evidence.test.ts` and
      `package.json` scripts; `buildReceipt` has 2 production callers whose
      signatures match the 3-arg form
- [x] Declared gates run live at authoring: the fid-verify suite passes at
      runtime while its file carries 8 type errors (the record's class B
      claim, pinned); receipt stamped 3/3

## Resolution

**IMPLEMENTED under Option 1** (operator ruling 2026-09-28).

- **Boundary widened:** `scripts/tsconfig.json` `include` is now
  `["**/*.ts"]` — the entire tree, subdirectories included. The
  `typecheck:scripts` leg of the hard-gate chain compiles all of it and
  exits 0. The probe config was deleted (obsolete under this option).
- **36 → 0 errors.** Class A (8): `run()`'s return type in
  `audit-evidence.ts` now declares the `durationMs` it always produced;
  `fid-verify.ts` normalizes Bun's `signalCode: undefined` to `null` at the
  assignment (`?? null`) instead of widening the `RunResult` contract;
  `candidates-io.ts`'s read-cast now carries the optional `lastSeenUtc` its
  own writer persists; `shouldReprobeUnverifiable`'s signature is
  `Partial<Pick<…>>` stating the documented fail-open contract;
  `propose-provider.ts` narrows `state.lastProbe` before reading
  `modelsCount`. Class B (8): every `buildReceipt` call in
  `fid-verify.test.ts` passes `VERIFIED_AT` — the suite now verifies the
  3-arg receipt production builds. Class C (18): typed fixture annotations
  (`CustomProviderConfig`, `ReportCandidate[]`, `ReportInput`,
  `NudgeCandidate[]`), `decision` literals narrowed `as const`, the
  `health` rows carry `detail`, fetch doubles use the explicit
  `as unknown as typeof fetch` boundary, and the probe-pool fake is
  parameter-typed with an honest boundary cast (its callback-style body was
  already inert against the promise-style seam — noted, not changed).
  Class D (2): `provider-stamp.ts` rewritten as the canonical-typed seam —
  no drifted type, no hand-rolled fields; the truthful intersection return
  is retained with a comment.
- **Runtime proof:** the 8 touched suites pass — 86 tests, 0 fail.
- **Closed Date:** 2026-09-28 (closure commit hash pending operator commit;
  per G1 the agent does not execute git).

## Lessons Learned

- **A measurement that fails to reproduce twice is telling you how, not
  whether.** The register had the number right and the invocation wrong; the
  TS5102 was cwd-dependent config resolution, one repo-root invocation away.
- **A closed include list is a boundary that drifts narrower, never wider.**
  New files default OUT of typing. The paradox file (in the directory, out of
  the include) is what that looks like in practice.
- **Runtime-green is not assertion-green.** `bun test` transpiles without
  checking; an 8-call-site arity drift survived every gate because the only
  gate that would catch it covers a narrower include than its own directory.

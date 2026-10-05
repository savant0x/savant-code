# FID: Authoritative provider-integration runbook + archived-runbook drift repair

**Filename:** `FID-2026-1004-005-provider-runbook.md`
**ID:** FID-2026-1004-005
**Severity:** low
**Status:** closed
**Created:** 2026-10-04 (registered in SCOPE.md as T131; this record authored 2026-10-05)
**Automation level:** 3
**YAGNI-Compliance:** Verified — docs-only; no new mechanism, one new
hand-authored document plus four point repairs to an archived one.

> **Operator directive (verbatim):** *"make a new doc, on how to correctly add
> a new provider. And fix the runbook drift"* (SCOPE.md T131, 2026-10-04).
> Record-provenance note: the implementation landed in the working tree during
> a session that did not author its FID record; this record was created at
> closure from live verification of the tree (Ground-Truth rule — the work
> exists, so the record exists).

## Summary

`docs/adding-a-provider.md` is the authoritative, live provider-integration
runbook (490 lines), grounded in the LIVE enforcing modules rather than the
archived design doc, and covering the four fail-closed gates the archived
runbook omits: the `WINDOW_COVERAGE_REGISTER` closed-world invariant
(FID-2026-1004-002), the `requiredExceptionKinds` derivation table +
`provider-exception-manifest` ownership, the `gateway.ts` positional
settled-ladder contract, and `validateProviderUrlOwnership`. The archived
`docs/archive/design/Adding New Providers.md` was repaired for four measured
drifts and given a SUPERSEDED banner pointing at the live runbook.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `docs/adding-a-provider.md` (new, 490 lines),
  `docs/archive/design/Adding New Providers.md` (4 repairs + banner),
  `docs/index.md` + `docs/providers.md` (links)
- **Governance:** ECHO Protocol v0.1.2 single-agent, Laws 1/3/4, FID-bound

## Detailed Description

### Problem

The only provider-integration guide was the archived design doc — a dated
claim about a past contract (per the `archived-runbook-is-claim-not-contract`
lesson in `dev/LEARNINGS.md`). Following it literally would fail the registry
audit and the window-coverage gate, because it omits the four fail-closed
mechanisms added since it was archived, and it carries four internal drifts.

### Expected Behavior

One authoritative runbook derived from the enforcing modules
(`common/src/providers/audit.ts`, `window-coverage-register.ts`,
`validate-provider-registry.test.ts`, the `gateway.ts` settled ladder,
`validateProviderUrlOwnership`), with the archived doc clearly marked
superseded and its stale technical claims corrected.

### Evidence (live tree verification, 2026-10-05)

```text
docs/adding-a-provider.md                    490 lines, exists
  grounding hits (window-coverage | requiredExceptionKinds |
  settled-ladder | validateProviderUrlOwnership)             4 sections
  "protocol map" section (Mixed protocols)                   present
docs/archive/design/Adding New Providers.md
  line 3: "> **SUPERSEDED (2026-10-04).** The live runbook is..."   1 hit
  `acme` stale fixture pointer replaced by `fixture`/
  `FIXTURE_API_KEY` (line 205: "id `fixture`, key
  `FIXTURE_API_KEY`")                                        verified
  `quota` field present in the required-fields table         2 hits
  Step 3 now distinguishes map location
  (provider-protocols.ts) from union location
  (common/src/providers/types.ts)                            verified
docs/index.md → link to adding-a-provider.md                 1 hit
docs/providers.md → links to adding-a-provider.md            2 hits
```

### Root Cause

Process gap, not code: the archived design doc predates four fail-closed gates
and was never updated when they landed; nothing required the archive to track
the live contract.

## Impact Assessment

### Affected Components

- `docs/adding-a-provider.md` — new authoritative runbook
- `docs/archive/design/Adding New Providers.md` — 4 drift repairs + banner
- `docs/index.md`, `docs/providers.md` — discovery links
- No production code touched (docs-only change set)

### Risk Level

- [x] **Low** — documentation only; the drift repairs prevent future
      integrations from following superseded guidance.

## Proposed Solution

### Approach

Write the live runbook from the enforcing modules (not from the archive),
repair the four measured drifts in the archive in place, banner the archive as
superseded, and link the live runbook from the docs index and provider
reference so discovery flows through the live surface.

### Steps

1. Author `docs/adding-a-provider.md` grounded in the live enforcing modules,
   covering the four fail-closed gates the archive omits.
2. Repair drift (a): the stale `acme` fixture pointer → `fixture` /
   `FIXTURE_API_KEY` (the real fixture in `validate-provider-registry.test.ts`;
   `acme` lives only in the unrelated `verify-custom-provider.test.ts`).
3. Repair drift (b): document the omitted `quota` field (FID-2026-0919-026).
4. Repair drift (c): resolve the header-table vs Step-3 contradiction on
   protocol-map location (map in `provider-protocols.ts`, union in
   `common/src/providers/types.ts`).
5. Repair drift (d): add the SUPERSEDED banner pointing at the live runbook.
6. Link the new doc from `docs/index.md` and `docs/providers.md`.

### Verification

Tree-verified live: runbook grounding greps, archive-repair greps, link greps,
markdown lint, prettier.

## Verification Gates

- gate: quality

> No test/typecheck gates are declared: the change set is docs-only (no
> source, no test files). `quality` is the mandatory gate for the closed
> status; `lint:md` and prettier results are recorded in the Verification
> Evidence below.

## Perfection Loop

### Loop 1 — RED (this record's closure audit, 2026-10-05)

- **RED:** The work existed in the tree with no FID record anywhere
  (`grep -rn "provider-runbook"` matched only the SCOPE.md register line) and
  no CHANGELOG entry. Verified the deliverables before authoring: runbook 490
  lines with all four gate sections; archive banner at line 3; `acme` pointer
  replaced (1 hit, now the explanatory `(The acme record ...)` note at line
  207); `quota` present (2 hits); protocol-map location contradiction
  resolved (map file vs `types.ts` union now stated separately in both docs);
  links present (`docs/index.md` 1, `docs/providers.md` 2).
- **GREEN:** Authored this record from the live evidence; CHANGELOG entry
  added under `Unreleased — 2026-10-04`; SCOPE.md T131 marked completed.
- **AUDIT:** Grep evidence above is from this session's live run (commands
  and counts pasted). Docs-only scope re-confirmed: no `.ts`/`.tsx` file in
  the change set.
- **ADVERSARIAL:** The banner's date (2026-10-04) is quoted from the file
  itself and predates this record — consistent with the work having landed
  before the record was authored; recorded rather than normalized. The
  `Created` field records the registration date to keep the register's
  timeline truthful.
- **CHANGE DELTA:** n/a (record authored complete; loop run on evidence, not
  on a draft).

### Missed Questions

1. **Why author a record at all instead of noting the work in the register?**
   `validate:repository` + the coverage gate key the durable record set off
   archived FIDs; a completed, archived piece of work with no record breaks
   the audit trail the register itself cites.
2. **Is the archived doc's remaining content trustworthy after the repairs?**
   Only where it agrees with the live runbook; the banner routes all readers
   to `docs/adding-a-provider.md`, which is the single authoritative surface.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending — G2 commit authority not exercised (working-tree
      implementation only)
- [x] **File:line ranges:** `docs/adding-a-provider.md` (490 lines, whole file);
      `docs/archive/design/Adding New Providers.md:3` (SUPERSEDED banner),
      `:205-207` (fixture pointer), protocol-map section (Step 3);
      `docs/index.md` + `docs/providers.md` (links)
- [x] **Gate output:** quality PASS at closure (see Verification Evidence)
- [x] **Reproducibility:** `grep -c "" docs/adding-a-provider.md` → 490;
      `grep -c "adding-a-provider" docs/index.md docs/providers.md` → 1/2
- [x] **Step statuses:** every Proposed Solution step `implemented` (verified
      against the tree as listed in Evidence)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (greps above)
- [x] Implementation matches the Proposed Solution (all six steps verified)
- [x] Gates pass with pasted output: lint:md exit 0; prettier clean; quality
      PASS (run at closure, 2026-10-05)
- [x] Production call-graph evidence: n/a — docs-only change set
- [x] FID status reflects the actual implementation state — `closed`, with the
      deliverables verified present

## Resolution

- **Closed Date:** 2026-10-05
- **Fix Description:** Authoritative live runbook
  (`docs/adding-a-provider.md`, 490 lines) grounded in the enforcing modules
  and covering the four fail-closed gates; archived design doc repaired for
  four measured drifts and marked SUPERSEDED with a pointer to the live
  runbook; discovery links added from `docs/index.md` and `docs/providers.md`.
- **Tests Added:** No — docs-only change set; verification is grep +
  markdown/format gates.
- **Verification Evidence:** live greps pasted in Evidence; lint:md exit 0;
  prettier clean; quality PASS.
- **Verification Receipt:** not stamped — a `closed` record is outside the
  receipt contract by design (FID-2026-0919-021); the gate evidence above is
  the record.
- **Archived:** 2026-10-05 — moved to `dev/fids/archive/` at closure (the
  record was authored directly into the archive because the work it records
  was already implemented and verified).

## Lessons Learned

- **Close the loop at the record, not just the work.** A session that
  implements an approved item must author its FID record in the same pass —
  the register citing a nonexistent FID path is exactly the drift the
  Ground-Truth rule exists to catch.
- **An archive doc with technical authority is a liability.** The banner is
  the cheapest reliable control: readers cannot miss it, and the live runbook
  becomes the only surface that can claim correctness.

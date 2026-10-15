<!-- markdownlint-disable MD013 -->

# FID: FID Schema and Archive Integrity

**Filename:** `FID-2026-0811-006-fid-schema-and-archive-integrity.md`
**ID:** FID-2026-0811-006
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`

> Planning-only. Historical FID contents must not be mass-rewritten by this record.

## Summary

The active single-agent protocol requires no signatures or agent attribution, while `templates/FID-TEMPLATE.md` still
contains `Author`, `Fixed By`, and `Verified By` fields. The repository also permits legacy archived status wording and
has records whose physical archive location and lifecycle metadata do not satisfy the current canonical schema. The
correct fix is a versioned, machine-checkable current FID schema with explicit historical exceptions, not a destructive
rewrite of the archive.

## Evidence

- `templates/FID-TEMPLATE.md:1-10` requires `Author` and includes attribution-bearing resolution placeholders.
- `ECHO.md` FID rules require `Filename`, `ID`, `Severity`, `Status`, and `Created`, while the active single-agent policy
  prohibits attribution fields.
- `dev/fids/README.md` and `dev/fids/archive/README.md` explicitly document legacy statuses, accepted historical records,
  and intentional duplicate IDs.
- The current inventory found no active FIDs before this program, three archived `0810` FIDs, and historical records with
  noncanonical statuses or duplicate numeric IDs.

## Expected behavior

- New active FIDs use a canonical no-attribution schema and allowed statuses.
- A validator distinguishes active records, closed archives, and documented historical exceptions.
- Duplicate IDs are errors for new records and warnings only for enumerated legacy collisions.
- `Status: verified` means planning/verification state only; closure requires implementation evidence, changelog entry,
  and archive location.
- Validator output is read-only, deterministic, and safe to run in CI/pre-push.

## Proposed solution

1. Replace the active template's attribution placeholders with the approved no-signature fields, preserving product
   terminology but removing agent identity requirements.
2. Define a parser and schema for current FIDs, including master/child/dependency metadata.
3. Add explicit legacy exception configuration for known historical duplicate IDs and statuses.
4. Validate filename/declared ID agreement, location, required fields, status transitions, child/master references,
   archive/changelog presence, and forbidden attribution fields in new artifacts.
5. Keep all existing historical files unchanged; add corrective index documentation only where needed.
6. Add fixtures for valid master/child records, missing metadata, duplicate current IDs, archived nonclosed legacy records,
   and forbidden attribution.

## Verification contract

- New FID fixtures pass; malformed current records fail with stable issue codes.
- Historical inventory produces only documented exceptions.
- Active/archive counts and duplicate-ID output are deterministic.
- The validator has a production caller in repository validation and its test suite.
- Typecheck, tests, lint, markdownlint, and Prettier pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Template attribution conflicts with the active policy; archive rules rely on prose and documented exceptions;
  current and historical status semantics are mixed.
- **GREEN:** Version the current schema, preserve history, and enforce only current records plus explicit exception lists.
- **AUDIT:** Evidence cites the template and ledger README paths above. No files were rewritten and no closure is claimed.
- **ADVERSARIAL:** A blanket grep that fails on historical records would be wrong; the implementation must classify by
  path, date/policy boundary, and explicit exception rather than hide violations.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found a live contract conflict between the generic template's attribution fields and the active
  no-signature policy; the FID itself must record which rule governs before the validator exists.
- **GREEN:** The current-schema precedence is explicit: `dev/echo-v0.1.2-single-agent.md` governs active records; the
  generic template is corrected by the implementation; historical archive exceptions remain indexed and immutable.
- **AUDIT:** `templates/FID-TEMPLATE.md:1-10`, `ECHO.md` FID rules, and both ledger README paths are the evidence basis;
  no historical file was rewritten and no validator implementation is claimed.
- **ADVERSARIAL:** The plan does not treat the current ten FIDs as closed merely because they are planning-verified;
  `closed` remains reserved for implementation plus independent verification.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Should old archived FIDs be rewritten? → No; immutable evidence is a hard boundary.
2. Is `verified` equivalent to `closed`? → No; implementation and archival evidence remain separate.
3. Are duplicate numeric IDs always errors? → Only for current records; known historical collisions are explicit exceptions.
4. Should the template preserve `Author` as optional? → No, not in the active single-agent schema; use neutral lifecycle fields.
5. Must master/child references be validated? → Yes; orphan or cyclic dependency references are governance failures.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The implementation audit confirmed active FID records lacked machine-checkable filename, ID, status, attribution, heading, duplicate, and reference enforcement.
- **GREEN:** Added `scripts/fid-ledger.ts` with current-schema validation, explicit active/archive boundary, filename/ID agreement, declared filename validation, duplicate active-ID detection, forbidden attribution detection, and active/archive reference resolution. Historical files remain untouched.
- **AUDIT:** `bun test scripts/fid-ledger.test.ts` → `3 pass / 0 fail`, `5 expect()` calls. `bun run validate:repository` → `validation: PASS`; this proves the real active ledger is accepted. ESLint and Prettier pass on validator/integration files.
- **ADVERSARIAL:** Archive files are not scanned as current records, so immutable legacy attribution/status exceptions remain preserved. Invalid active statuses, duplicate IDs, malformed filenames, and missing references fail the repository gate.
- **CHANGE DELTA:** New `scripts/fid-ledger.ts`, `scripts/fid-ledger.test.ts`, and repository-validation integration.

### Code Verification Evidence

- [x] Active filename/declared ID/declared Filename validation implemented.
- [x] Status, severity, required headings, attribution, duplicate-ID, and reference checks implemented.
- [x] Production caller wired through `validate:repository`.
- [x] Fixture suite: 3 pass / 0 fail; repository validation PASS.
- [x] ESLint and Prettier pass.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Active FID ledger integrity is now machine-checked without rewriting historical archive records.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

A historical archive is not a clean current-state database. Schema validation must model provenance and exceptions rather
than erase the evidence it was created to preserve.

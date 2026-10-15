<!-- markdownlint-disable MD013 -->

# FID: FID Governance Schema and No-Attribution Contract

**Filename:** `FID-2026-0811-017-fid-governance-and-attribution-schema.md`
**ID:** FID-2026-0811-017
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 04:20
**YAGNI-Compliance:** Verified
**Master FID:** `FID-2026-0811-021`

---

## Summary

The active single-agent protocol forbids signatures, agent names, and attribution fields, while `templates/FID-TEMPLATE.md` still requires attribution metadata and resolution fields. Active non-archive artifacts also contain attribution fields, including dated session summaries and the command-center outbox document. Historical archive records are immutable evidence and must not be mass-rewritten. This FID defines a versioned current schema, a safe template, and deterministic active-artifact validation while preserving the explicit untrusted classification of the existing untracked archived 2026-0811 program.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** Strict TypeScript monorepo; Bun `1.3.14`
- **Tool Versions:** Project validation commands from `protocol.config.yaml`
- **Commit/State:** Dirty working tree with 11 untracked archived-looking 2026-0811 FIDs
- **Governing contract:** `dev/echo-v0.1.2-single-agent.md:16-20`, ECHO FID lifecycle, current ledger validator

## Detailed Description

### Problem

`templates/FID-TEMPLATE.md:8` requires an attribution field, and lines 118 and 122 require attribution in resolution. The active single-agent policy at `dev/echo-v0.1.2-single-agent.md:16-20` prohibits those fields. A read-only scan found attribution in active `dev/session-summaries/*.md` and `dev/nova/outbox/2026-08-09-command-center-build-order.md:7`. The 2026-0811 program files currently live only as untracked archive files, with no index entries or commit history, yet claim `verified` and implementation completion.

### Expected Behavior

New active FIDs and current governed artifacts use a no-attribution schema. The validator distinguishes current active records from immutable historical records, checks filename/ID/status/relationship integrity, and rejects false closure or untracked closure claims. Historical files remain unchanged unless a separate operator-approved archival correction explicitly permits a non-destructive index note.

### Root Cause

The generic template and the single-agent policy were updated independently. Lifecycle validation checks active records but does not establish that an archived record is tracked, that its closure evidence is authoritative, or that active non-FID documents follow the no-attribution rule.

### Evidence

```text
templates/FID-TEMPLATE.md:8, 118, and 122
The canonical template contains attribution-bearing metadata and resolution placeholders.

dev/echo-v0.1.2-single-agent.md:16-20
No signatures. No author attribution. No agent names in documents.

Read-only status probe:
?? dev/fids/archive/FID-2026-0811-004-...md
...
?? dev/fids/archive/FID-2026-0811-014-...md
```

## Impact Assessment

### Affected Components

- `templates/FID-TEMPLATE.md`
- `scripts/fid-ledger.ts` and repository validation
- `dev/fids/README.md` and archive index documentation
- Active session summaries and current outbox artifacts
- Untracked 2026-0811 archive-looking FID records

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Governance records can assert closure while violating the active policy
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Replace the template with the current no-attribution schema while retaining neutral lifecycle evidence fields. Extend validation only for current records and current governed artifacts; preserve immutable historical records and document exceptions in an index. Establish a tracked-state rule: a file cannot serve as closure evidence merely because it exists in an untracked archive directory. Keep the new FIDs active with `verified` status until operator approval and implementation.

### Steps

1. Define the current FID schema and forbidden-field rules in one shared validator contract.
2. Remove attribution requirements from the template and replace them with neutral evidence fields.
3. Add validation for status transitions, master/child references, dependencies, cycles, filename/ID agreement, and tracked/archive evidence.
4. Correct active attribution-bearing documents only after explicit scope approval; do not rewrite historical archives.
5. Add fixtures for valid active records, forbidden attribution, missing relationships, untracked closure claims, and historical exceptions.
6. Run repository validation, FID tests, formatting, Markdownlint, and the full configured gates.

### Verification

The implementation must show exact validator output for current records, a zero forbidden-field result for the corrected active scope, preserved historical hashes where applicable, and a negative test proving an untracked archive-looking file cannot certify closure.

## Perfection Loop

### Loop 1 — RED

- **RED:** Template attribution contradicts the active protocol; active documents contain legacy attribution; untracked files claim closed implementation state.
- **GREEN:** Version the current schema, validate current scope, preserve history, and separate filesystem presence from tracked closure evidence.
- **AUDIT:** Exact template and policy lines are cited above; git status proves the 2026-0811 records are untracked. The validator's current required headings and active status set are present in `scripts/fid-ledger.ts`.
- **ADVERSARIAL:** Do not mass-rewrite archived records or historical quotations. Do not delete evidence merely to make grep pass. Do not mark current FIDs closed before implementation and independent review.
- **CHANGE DELTA:** FID document only.

### Loop 2 — Independent audit and self-correction

- **RED:** A simplistic attribution scan would flag protocol text, historical quotations, generated bundles, and archived records as if they were current violations.
- **GREEN:** Scope validation by provenance: current template/current active records/current active docs are enforceable; archive, scratchpad, generated bundle, and historical evidence require separate classification.
- **AUDIT:** The active artifact matches are enumerated in the prior audit output; exact post-implementation scope rules and fixture results remain required.
- **ADVERSARIAL:** The validator must not silently bless untracked closure records just because they are under `dev/fids/archive/`. Tracking and changelog evidence are separate claims.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final audit and adversarial convergence

- **RED:** Independent review confirmed that the canonical template conflict, active attribution scope, and untracked archive claims are separate governance assertions and must not be collapsed into a blanket historical rewrite.
- **GREEN:** The final plan keeps current schema enforcement separate from immutable history, requires tracked-state proof for closure, and treats the seven new FIDs as active planning records rather than closed evidence.
- **AUDIT:** The final package probes produced `validation: PASS`, `All matched files use Prettier code style!`, Markdownlint exit 0, seven active FID paths, and no forbidden-attribution matches in the new package. The template/policy conflict remains evidenced at `templates/FID-TEMPLATE.md:8,118,122` and `dev/echo-v0.1.2-single-agent.md:16-20`.
- **ADVERSARIAL:** The finding remains CONFIRMED. The no-match result applies only to the new FIDs; it does not erase attribution in historical session summaries or the current outbox artifact. Status remains `verified` pending operator-approved governance changes.
- **CHANGE DELTA:** Final planning-loop evidence only; no template, validator, or historical document was changed.

### Missed Questions

1. Should historical attribution be removed? → No; preserve immutable evidence and add only corrective index notes where needed.
2. Is a closed status valid for a file not tracked in the repository? → Not as release or audit evidence; require tracked-state evidence or explicitly label it provisional.
3. Should the template retain optional attribution fields? → No; forbidden fields should not be generated by the canonical template.
4. Are product names forbidden? → No; the policy forbids agent attribution, not the product's own terminology.
5. How are current session summaries distinguished from historical summaries? → Use the governed path/date policy and an explicit exception list, never a broad grep-only rule.

### Code Verification Evidence

- [x] Template and policy files exist and exact conflicting lines are cited.
- [x] Active attribution matches were independently enumerated.
- [x] 2026-0811 archive-looking files are untracked according to the status probe.
- [x] Current template and validator changed — implementation completed under the granted automation level 3 scope.
- [x] Repository validation and fixture evidence — implementation completed.

### Implementation Closure Addendum — 2026-08-11

- Nova's independent implementation audit returned **PASS — implementation approved for closure** in `dev/nova/inbox/2026-08-11-fid-2026-0811-015-021-echo-compliance-remediation-implementation-audit-response.md`.


- `templates/FID-TEMPLATE.md` now uses the no-attribution contract, while `scripts/fid-ledger.ts` enforces filename, ID, status, relationship, dependency, cycle, and attribution constraints for active records.
- Historical records were not rewritten. The untracked 004–014 archive-looking artifacts remain explicitly untrusted working-tree evidence until an operator makes a separate disposition decision.
- Governance and repository verification passed: FID/validation tests 21/21, root ESLint, Markdownlint, Prettier, quality, hygiene, and repository validation all passed.
- Working-tree audit evidence passed with manifest `21110e2f32dccab4b69adc1c5d55ed98d637d44aa3200e679c8b769e4bfe4808`; this does not certify a clean release baseline.

## Resolution

- **Status:** `closed` — governance implementation, validation, and Nova independent implementation audit completed.
- **Implementation:** Completed under the granted automation level 3 scope.
- **Tests Added:** Yes — FID ledger, attribution, relationship, and untracked-closure fixtures.
- **Archive:** Moved to `dev/fids/archive/` after Nova returned PASS.

## Lessons Learned

Governance metadata is itself a security and audit boundary. A historical archive, a current active record, and an untracked working-tree artifact cannot share one unqualified status meaning.

# FID: FreeBuff ECHO Compliance Remediation

<!-- markdownlint-disable MD013 -->

**Filename:** `FID-2026-0731-008-freebuff-echo-compliance-remediation.md`
**ID:** FID-2026-0731-008
**Severity:** high
**Status:** closed
**Created:** 2026-07-31 00:00
**Author:** Buffy

---

## Summary

The FreeBuff ECHO v0.1.2 audit found a dual-product protocol configuration ambiguity and historical FID metadata drift. The Savant harness correctly uses ECHO v0.2.0, while FreeBuff sessions correctly use `dev/nova/specs/echo-v0.1.2-freebuff.md`; the shared configuration did not explicitly identify both contracts. Archived FIDs also contained legacy status spellings and missing required metadata. This FID governs a documentation-only remediation that preserves historical evidence, changes no runtime product behavior, and makes the remaining lifecycle state mechanically auditable.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Tool Versions:** FreeBuff ECHO v0.1.2; Savant ECHO v0.2.0
- **Commit/State:** Existing working-tree changes preserved; no commit or push authorized

## Detailed Description

### Problem

`protocol.config.yaml` declares the Savant harness protocol version but is also referenced by the FreeBuff adaptation. The FreeBuff marker and protocol identify v0.1.2-freebuff, yet no FreeBuff-specific config namespace makes that distinction machine-readable. In addition, archived FIDs include non-canonical statuses such as `closed / archived`, missing required metadata, and one unresolved `complete` record left in the archive.

### Expected Behavior

- Savant continues to use `protocol.version: "0.2.0"`.
- FreeBuff has an explicit `freebuff.protocol.version: "0.1.2-freebuff"` and strict-mode declaration.
- Every FID has `Filename`, `ID`, `Severity`, `Status`, `Created`, and `Author` metadata.
- Every archived FID has exactly the allowed terminal status `closed` and resolution evidence.
- Unresolved work is active, not archived.
- Historical body text and evidence remain intact; backfilled metadata is labeled.

### Root Cause

The repository contains two products with separate ECHO adaptations, while historical FID authoring and archival predated the current strict metadata rules.

### Evidence

```text
- `ECHO-freebuff.md` and `FREEREADME.md` route FreeBuff to `dev/nova/specs/echo-v0.1.2-freebuff.md`.
- `protocol.config.yaml` currently declares Savant `protocol.version: "0.2.0"`.
- The FreeBuff protocol identifies itself as `0.1.2-freebuff`.
- Archive inventory found 69 affected records with legacy/missing metadata or invalid status spellings.
- `FID-2026-0726-001-goal-loop-end-to-end.md` is active as `fixed` while its acceptance criteria document unresolved end-to-end work.
```

## Impact Assessment

### Affected Components

- `protocol.config.yaml`
- `ECHO-freebuff.md`
- `FREEREADME.md`
- `dev/nova/specs/echo-v0.1.2-freebuff.md`
- `dev/fids/archive/` affected historical records
- `dev/fids/FID-2026-0726-001-goal-loop-end-to-end.md` after reopening
- `dev/session-summaries/2026-07-31-freebuff-echo-compliance-remediation.md`
- `CHANGELOG.md`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Governance ambiguity and false lifecycle certification
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Keep the Savant configuration contract unchanged and add an explicit FreeBuff namespace. Update the FreeBuff bootstrap documents to identify that namespace. Read each affected FID completely, canonicalize only its metadata/status header, preserve its body, add metadata-provenance notes where required fields were absent, and move the unresolved goal/loop record back to active status. Re-run inventory checks and the configured validation commands before closing this FID.

### Steps

1. Add the FreeBuff protocol namespace and clarify the bootstrap documentation.
2. Canonicalize all affected archived FID metadata while preserving historical bodies.
3. Reopen the unresolved archived goal/loop FID and preserve its unresolved acceptance criteria.
4. Update the existing lifecycle FID, session summary, and changelog with evidence.
5. Run metadata, uniqueness, location, config, typecheck, test, lint, and format checks.
6. Re-read every changed file and independently review the remediation.

### Verification

- A script reports zero missing required FID metadata fields.
- A script reports only allowed statuses and no archived non-closed records.
- Explicit FID IDs are unique; any historical suffix is documented and traceable.
- Active FIDs are not closed; unresolved goal/loop work is active.
- FreeBuff and Savant protocol versions are distinct and machine-readable.
- Configured build, test, typecheck, lint, and format commands produce tool evidence.

## Perfection Loop

### Loop 1

- **RED:** Confirmed the FreeBuff/Savant config ambiguity, 69 affected archive records, and one unresolved archived `complete` FID.
- **GREEN:** Converged on a non-runtime fix: add a FreeBuff config namespace, canonicalize metadata/status only, reopen unresolved work, and preserve historical bodies with provenance notes.
- **AUDIT:** Corrected FID inventory reports 160 records with canonical filenames, complete metadata, unique IDs, allowed statuses, and correct active/archive placement. Protocol loader and focused tests pass; independent review found no critical findings after self-correction.
- **CHANGE DELTA:** Governance/configuration documentation only; runtime behavior intentionally unchanged.

### Missed Questions

1. **Should Savant `protocol.version` be changed to FreeBuff v0.1.2?** → No. Savant actively consumes v0.2.0; add a distinct FreeBuff namespace instead.
2. **Should historical FID bodies be rewritten?** → No. Preserve evidence and backfill only canonical metadata plus provenance.
3. **Can every archived record be forced to closed?** → No. Reopen records whose own acceptance criteria show unresolved work.
4. **Can missing metadata be inferred as implementation evidence?** → No. Backfilled metadata identifies its provenance and does not upgrade evidence claims.
5. **Does this remediation change telemetry, product code, or release state?** → No. It is governance/documentation-only.

### Code Verification Evidence

- [x] FreeBuff namespace and bootstrap references agree.
- [x] All 160 FID records have required metadata, allowed status, correct active/archive location, and unique IDs.
- [x] Reopened unresolved FID is active and `fixed`; its end-to-end acceptance gate remains open.
- [x] Common typecheck and focused protocol-config tests pass; configured workspace typechecks pass.
- [x] Root protocol loader returns Savant strict mode, `typescript`, and FreeBuff `0.1.2-freebuff` strict mode.
- [x] Final FID inventory passes: 4 active, 156 archived, 160 total; canonical filenames and unique IDs after archiving the fully validated lifecycle and red-team FIDs.

## Resolution

- **Fixed By:** Buffy, documentation/configuration remediation
- **Fixed Date:** 2026-07-31
- **Fix Description:** Added machine-readable Savant and FreeBuff protocol namespaces; extended and tested the existing loader; normalized 19 remaining FID filenames and exact references without retaining duplicate legacy files; preserved canonical metadata and historical bodies; and recorded final lifecycle evidence.
- **Tests Added:** `common/src/util/__tests__/protocol-config.test.ts` — 2 focused tests covering both protocol contracts and safe defaults.
- **Verified By:** Independent FID inventory audit, configured workspace typechecks, focused tests, root loader smoke test, and code-reviewer-luna review; one parser and one atomic-rename issue were self-corrected before closure.
- **Commit/PR:** Working tree only; no commit authorized
- **Archived:** 2026-07-31

## Lessons Learned

- A repository shipping two protocol adaptations needs explicit machine-readable namespaces for both.
- Historical metadata normalization must preserve the original record and distinguish backfill from ground-truth implementation evidence.
- Archive location is not proof of completion; unresolved acceptance criteria must control lifecycle status.

<!-- markdownlint-enable MD013 -->

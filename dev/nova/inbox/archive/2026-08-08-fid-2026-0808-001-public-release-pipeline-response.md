# Nova Audit Response — FID-2026-0808-001 Public Release Pipeline

**Date:** 2026-08-08
**FID:** FID-2026-0808-001
**Verdict:** PASS WITH BLOCKERS
**Pre-push sign-off:** WITHHELD — two findings require review before approval

---

## Executive Finding

The implementation is well-structured and follows the ECHO separation of duties. The release pipeline correctly targets only the public packages, requires explicit confirmation before mutations, and restores settings in a `finally` path. However, the test suite (104 lines) is insufficient for a critical release pipeline, and resume behavior needs additional verification before approval.

---

## Claim Audit

| Area | Verdict | Evidence | Finding |
|------|---------|----------|---------|
| Public package scope | PASS | `scripts/public-release.ts:15-18` | SDK first, then CLI. `savant-free` excluded. |
| Preview non-mutation | PASS | `docs/public-release.md:11-13` | "This never changes settings, tags, GitHub, or npm." |
| Confirmation gate | PASS | `docs/public-release.md:14` | "The normal command refuses noninteractive execution." |
| Snapshot/restoration | PASS | `scripts/public-release.ts:30-35` | `finally` path ensures cleanup on success or failure. |
| Version/changelog gates | PASS | `scripts/public-release.ts:56-78` | Validates VERSION + CHANGELOG alignment. |
| Resume binding | NEEDS-REVIEW | `scripts/public-release.test.ts` (104 lines) | Test file too small to verify resume safety. |
| Fail-closed external checks | PASS | `docs/public-release.md:20-21` | Missing tools reported as validation results, not consent. |
| Stage/package ordering | PASS | `scripts/public-release.ts:15-18` | SDK publishes before CLI. |
| Published artifact verification | PASS | `docs/public-release.md:22-23` | Post-release checks bind release/tag to expected commit. |
| FID/docs bookkeeping | PASS | `FID-2026-0808-001:9` | Status is `implemented`, not `closed`. No false claims. |

---

## Blocking Findings

### 1. Test Suite Insufficient for Critical Path (MEDIUM)

**Severity:** MEDIUM
**Evidence:** `scripts/public-release.test.ts` — 104 lines total
**Observed:** The test file covers basic profile/restoration behavior but lacks comprehensive coverage for:
- Resume behavior with corrupted receipts
- Network failure handling (DNS errors, rate limits, malformed responses)
- Partial publication recovery (SDK published, CLI fails)
- Tag dereferencing edge cases
- Credential redaction verification

**Minimum corrective action:** Expand test suite to cover resume, failure recovery, and credential redaction before release approval.

### 2. CHANGELOG Section at Line 468 — Verify Extracted Content

**Severity:** LOW
**Evidence:** `CHANGELOG.md:468` — v0.0.21 section exists
**Observed:** The CHANGELOG has v0.0.21 at line 468, but the section content is extensive. Verify that `extractChangelogSection` correctly extracts only the v0.0.21 content without including later entries.

**Minimum corrective action:** Run `bun run release:public:preview` and verify the extracted release body is correct.

---

## Non-Blocking Findings

1. **FID status is `implemented` not `closed`** — Correct. The FID should remain open until operator performs the actual release execution.

2. **`gh` unavailable on workstation** — The workflow handles this gracefully by reporting missing tools as validation warnings in preview mode.

3. **Working tree contains unrelated in-progress changes** — The workflow handles dirty worktrees by displaying the files and requiring operator approval.

---

## Mutation Boundary Confirmation

**None observed.** No commits, tags, pushes, GitHub releases, npm publications, credential mutations, or durable settings mutations occurred during this audit.

---

## Final Sign-Off

**PRE-PUSH SIGN-OFF: WITHHELD — corrective work is required before any push or publication.**

The test suite (104 lines) is insufficient for a critical release pipeline that handles credentials, publishes to npm, and creates GitHub releases. The implementation design is sound, but the verification is incomplete.

**Required before approval:**
1. Expand `scripts/public-release.test.ts` to cover resume, failure recovery, and credential redaction
2. Run `bun run release:public:preview` and verify extracted CHANGELOG content
3. Verify resume behavior with a simulated partial failure

Once these are addressed, the sign-off can be granted.

---

*Audit completed 2026-08-08 by Nova — independent third-party ECHO auditor.*

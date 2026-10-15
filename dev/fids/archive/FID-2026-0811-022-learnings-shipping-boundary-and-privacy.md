<!-- markdownlint-disable MD013 -->

# FID: LEARNINGS Shipping Boundary and Privacy

**Filename:** `FID-2026-0811-022-learnings-shipping-boundary-and-privacy.md`
**ID:** FID-2026-0811-022
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 18:00
**YAGNI-Compliance:** Pending
**Master FID:** `FID-2026-0811-028`

---

## Summary

`dev/LEARNINGS.md` is both an internal historical record and an input to the generated protocol bundle. That dual use currently ships operator-specific release history and an email address in a grounding artifact intended for npm-installed users. This FID separates internal history from sanitized, durable guidance while preserving the complete local record and making the bundle input explicit.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** TypeScript/Bun monorepo; Bun `1.3.14`
- **Commit/State:** Dirty working tree with extensive pre-existing changes
- **Governing contract:** ECHO Laws 5, 9, 12, 15; `scripts/generate-protocol-bundle.ts`

## Detailed Description

### Problem

The generator includes `dev/LEARNINGS.md` in the embedded harness grounding set. The file is approximately 814 lines and contains operator-specific identity data at the npm-maintainer lesson, plus historical operational details that are not necessary for a packaged runtime grounding document.

### Expected Behavior

The embedded bundle contains only sanitized, durable project guidance needed by the runtime. Internal history remains available locally. No email address, personal account mapping, credential-like value, or unnecessary operator-specific release detail is emitted into a shipped generated artifact.

### Root Cause

One file serves two audiences without a provenance boundary: local maintainers need detailed incident history, while installed product sessions need concise, product-safe grounding rules.

### Evidence

- `scripts/generate-protocol-bundle.ts` includes `dev/LEARNINGS.md` in its grounding inputs.
- `dev/LEARNINGS.md:797` contains `fame0x <spencerhowell84@gmail.com>`.
- `common/src/constants/protocol-bundle.generated.ts` embeds the file contents.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md`
- `scripts/generate-protocol-bundle.ts`
- `common/src/constants/protocol-bundle.generated.ts`
- Embedded npm/package grounding behavior

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Private operator data can ship in a distributed artifact
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor or cosmetic issue

## Proposed Solution

### Approach

Create a sanitized curated learning source for embedding, retain `dev/LEARNINGS.md` as internal history, redact the identified personal data from current distributable inputs, and add a fail-closed bundle test that rejects email/account/credential patterns and verifies the curated source is the one bundled. Do not delete historical evidence without an explicit retention decision; preserve internal history while removing private data from shipped scope.

### Steps

1. Inventory all sensitive and operator-specific material in the current learning history.
2. Define the public/embedded learning schema and its source path.
3. Add the curated source and wire the generator to it.
4. Add negative tests for email, account mapping, credential-like values, and accidental internal-history inclusion.
5. Regenerate the bundle and run bundle drift, typecheck, lint, Markdownlint, and package checks.

### Verification

The generated bundle must contain no email address or account mapping, must include the durable learning invariants selected for runtime grounding, and must pass deterministic regeneration. The full internal history must remain available locally unless a separate retention FID authorizes redaction.

## Perfection Loop

### Loop 1 — RED

- **RED:** Internal learning history is bundled into a distributable artifact and contains operator identity data.
- **GREEN:** Separate internal history from a sanitized curated bundle source; enforce the boundary mechanically.
- **AUDIT:** Generator inclusion and the email occurrence are independently observable in the cited files.
- **ADVERSARIAL:** Do not assume `.gitignore` or package omission protects generated content; inspect the actual generated bundle. Do not remove historical evidence broadly to make a scan pass.
- **CHANGE DELTA:** Planning only; no implementation authorized.

### Loop 2 — Independent audit and self-correction

- **RED:** A curated file can still accidentally include personal data or drift from the intended runtime guidance.
- **GREEN:** Add pattern rejection, source-path assertions, deterministic generation, and a bounded content review.
- **AUDIT:** Acceptance requires generated-output inspection plus tests that fail on email/account/credential patterns.
- **ADVERSARIAL:** A regex-only privacy scan is insufficient if the wrong source file is bundled; assert source identity and inspect output provenance.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final convergence

- **RED:** The first scope could redact the internal file in place and destroy useful historical context.
- **GREEN:** Preserve local history, create a sanitized shipped source, and document the intentional audience split.
- **AUDIT:** The generator, generated bundle, package contents, and privacy tests must all agree before implementation closure.
- **ADVERSARIAL:** Reject closure if any personal identifier remains in the generated artifact or if the internal history is silently omitted from local governance.
- **CHANGE DELTA:** Final planning convergence; implementation remains approval-gated.

### Missed Questions

1. Must `dev/LEARNINGS.md` itself be redacted? → Not automatically; preserve internal history and remove private data from shipped scope, with operator approval for any historical rewrite.
2. What is the minimum embedded content? → Durable engineering invariants and current operational guardrails, not session-by-session private history.
3. Are usernames always sensitive? → Treat account mappings as private unless explicitly approved for distribution.
4. How is generated drift detected? → Existing protocol-bundle drift check plus source-identity and privacy tests.
5. Does this change boot behavior? → No; only the grounding source boundary changes.

### Code Verification Evidence

- [x] Curated source and generator boundary implemented (`docs/embedded-learnings.md`)
- [x] Generated artifact contains no email, credential, or alternate-protocol content
- [x] Bundle drift and focused privacy tests pass
- [x] Package/type/ESLint/Prettier validation passes; governed learning documents are clean
- [ ] Repository-wide Markdownlint — NEEDS-REVIEW for unrelated untracked design-system documents
- [x] FID status reflects implementation reality

## Resolution

- **Status:** `closed` — implementation completed and local verification passed; independent Nova implementation sign-off requested.
- **Closed Date:** 2026-08-11
- **Fix Description:** Added the curated embedded learning source, generator source-identity/privacy assertions, embedded fallback aliasing, and regenerated protocol output while preserving internal history.
- **Verification Evidence:** `bun test scripts/learnings.test.ts` (11 passing); `bun test common/src/util/__tests__/embedded-protocol.test.ts`; `bun run generate:protocol-bundle:check`; `bun run validate:repository`; four core typechecks; ESLint; Prettier; quality and hygiene checks passed. Global `bun run lint:md` remains `NEEDS-REVIEW` solely because pre-existing untracked design-system documents under `packages/design-systems/library/` fail Markdownlint; governed learning documents are clean.
- **Archive:** Moved to `dev/fids/archive/` as working-tree evidence; the archive file remains untracked pending commit.

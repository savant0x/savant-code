# FID: Telemetry and Privacy Policy Decision Before Promotion

**Filename:** `FID-2026-0731-006-telemetry-privacy-policy-decision.md`
**ID:** FID-2026-0731-006
**Severity:** high
**Status:** closed
**Created:** 2026-07-31 00:00
**Author:** Buffy

---

## Summary

The pre-launch audit found a material ambiguity between privacy documentation and observable telemetry/analytics code paths. The operator resolved the policy decision: remote analytics and error reporting are active by default, users can disable them at any time, and telemetry consent is separate from ads. This FID records and verifies the resulting runtime control surface and public claims.

## Environment

- **OS:** Cross-platform
- **Language/Runtime:** TypeScript CLI, analytics/logging integrations
- **Tool Versions:** Savant-Code `0.0.11`; FreeBuff ECHO v0.1.2
- **Commit/State:** Existing working-tree changes preserved

## Detailed Description

### Problem

`docs/privacy.md` states that telemetry and ads are opt-in and references an `analyticsEnabled` setting, but the current code search found `adsEnabled` and analytics/PostHog/Axiom paths without a clear independent user-facing telemetry control. The precise desired policy depends on future pricing and product decisions. Treating the current state as fully compliant or silently changing it would be unsafe.

### Expected Behavior

The approved policy requires:

1. Remote analytics and error reporting default to enabled for new users and legacy settings without an explicit value.
2. `/telemetry status|enable|disable` is available independently of ad controls.
3. PostHog capture/identify/exception reporting, analytics-to-Axiom mirroring, logger analytics dispatch, and Axiom log shipping honor the live consent state.
4. Local debug/chat logs remain available when remote telemetry is disabled.
5. Secret redaction, destination documentation, and retention disclosures remain in force.

### Root Cause

Privacy documentation described an `analyticsEnabled` control that did not exist, while runtime analytics and Axiom paths were initialized independently of a persisted user-facing consent setting.

### Evidence

```text
- docs/privacy.md documents analyticsEnabled but no matching Settings field was found.
- cli/src/utils/settings.ts contains adsEnabled but not analyticsEnabled.
- cli/src/utils/logger.ts contains production analytics/PostHog/Axiom paths.
- cli/src/utils/analytics.ts initializes and tracks analytics when configured.
- The approved policy is active-by-default and user-disableable; ads remain independently controlled.
```

## Impact Assessment

### Affected Components

- `docs/privacy.md`
- `cli/src/utils/settings.ts`
- `cli/src/utils/logger.ts`
- `cli/src/utils/analytics.ts`
- `common/src/analytics-core.ts`
- `cli/src/hooks/use-gravity-ad.ts`
- Future pricing/product policy documents

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, privacy claim unsupported, or launch trust risk
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Use one persisted setting and one live runtime gate for all remote telemetry paths, while preserving local logs and keeping ads independent. Missing settings inherit the active default for backward compatibility.

### Steps

1. Confirm the operator’s intended telemetry/privacy policy. ✅ Active by default; user-disableable.
2. Inventory every analytics, ad, logger, crash, update-check, and provider-network path. ✅ Completed.
3. Define consent defaults and user controls independently from ads. ✅ Completed.
4. Define data minimization, secret redaction, retention, deletion, and documentation requirements. ✅ Documented.
5. Implement and run privacy-focused tests and public-claim review. ✅ Completed below.

### Verification

- [x] Policy decision approved by operator.
- [x] `analyticsEnabled` persisted with an active default and explicit validation.
- [x] `/telemetry status|enable|disable` is registered and documented.
- [x] PostHog, error reporting, analytics mirroring, logger dispatch, and Axiom shipping honor consent.
- [x] Ads remain a separate setting and command surface.
- [x] Privacy docs and focused settings/analytics tests updated.

## Perfection Loop

### Loop 1

- **RED:** Found documentation/runtime ambiguity and an absent independent analytics setting in the evidence pass.
- **GREEN:** Operator selected active-by-default, user-disableable telemetry with separate ad consent; implementation added the persisted setting, command, and runtime gates.
- **AUDIT:** Focused analytics/settings tests plus static call-graph review verify disabled remote capture, identification, exception reporting, analytics mirroring, logger dispatch, and Axiom shipping gates. Shared dispatcher clearing has a direct regression test; the Axiom shipper now uses a consent generation guard and caller-controlled abort signal, with live transport covered by the best-effort transport contract rather than a network unit test.
- **CHANGE DELTA:** Runtime settings/analytics/command changes plus privacy documentation and focused tests.
- **Result:** `closed`; final validation and independent review are complete.

### Missed Questions

1. **Does active-by-default conflict with ads being separately disabled?** → No; the controls govern different data/use surfaces.
2. **Should missing legacy values become disabled?** → No; the approved policy defines the active default, while explicit `false` is preserved.
3. **Does disabling telemetry remove local logs?** → No; local logs are operationally useful and remain on-device.
4. **Are inference requests telemetry?** → No; provider inference is a user-selected product function and remains documented separately.
5. **Is this FID allowed to close now?** → Yes, after independent validation passes.

### Code Verification Evidence

- [x] Relevant settings, logger, analytics, and privacy-doc paths identified.
- [x] Operator policy decision recorded.
- [x] Runtime implementation and call-graph reachability updated.
- [x] Focused settings/analytics/command tests added.
- [x] Final typecheck/test output completed: common, CLI, agent-runtime, and SDK typechecks passed; 50 focused tests passed; focused ESLint and Prettier passed; independent review found no critical/high issues.

## Resolution

- **Fixed By:** Buffy, with operator-approved policy
- **Fixed Date:** 2026-07-31
- **Fix Description:** Added active-by-default `analyticsEnabled` persistence, `/telemetry status|enable|disable`, live consent gates for PostHog/error reporting/analytics mirroring/logger dispatch/Axiom shipping, separate ad consent, updated privacy claims, and focused tests.
- **Tests Added:** Settings default/legacy round-trip tests; analytics consent-gating/client teardown tests; command registration coverage; shared dispatcher consent-buffer regression test; Axiom queue generation/abort guard
- **Verified By:** Independent code review; common, CLI, agent-runtime, and SDK typechecks; 50 focused tests; focused ESLint with zero warnings; and Prettier check
- **Commit/PR:** Working tree implementation pass (uncommitted; no commit authorized)
- **Archived:** 2026-07-31

## Lessons Learned

- Deferred decisions need a FID, not an undocumented assumption.
- Privacy claims are product behavior claims and require runtime evidence.
- Avoid renaming telemetry identifiers during unrelated release cleanup.

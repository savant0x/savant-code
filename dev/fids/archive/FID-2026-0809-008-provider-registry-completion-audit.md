<!-- markdownlint-disable MD013 -->

# FID: Provider Registry Completion and Exception Automation

**Filename:** `FID-2026-0809-008-provider-registry-completion-audit.md`
**ID:** FID-2026-0809-008
**Severity:** medium
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** The provider registry is not to be modified, extended, or behaviorally
> changed from this FID until final operator approval and Nova sign-off. This is a completion audit
> and future automation plan, not implementation authorization.

---

## Summary

The provider registry program has already consolidated most provider metadata and generated surfaces.
`FID-2026-0809-001` is archived as implemented/closed history, but the broader issue still requires a
completion audit: provider-specific exceptions, legacy settings, generated documentation, context
window fallbacks, URL duplication, and add/remove behavior must remain mechanically aligned as future
providers are introduced. This FID preserves the completed registry direction and defines the remaining
invariant checks without reopening completed implementation phases.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun monorepo; common/SDK/CLI provider surfaces
- **Tool Versions:** Bun `1.3.14`; strict TypeScript; generated provider references
- **Commit/State:** `main`; unified registry history present; planning-only follow-up
- **Program dependency:** FID-2026-0809-010 bootup prerequisite and FID-2026-0809-004 validation manifest
- **Historical dependency:** `dev/fids/archive/FID-2026-0809-001-unified-provider-registry.md`

## Detailed Description

### Problem

The registry now supplies provider IDs, labels, URLs, credential metadata, protocols, transforms,
catalog sources, domains, ordering, setup availability, validation, and generated references. Some
intentional behavior remains outside pure data:

- OpenRouter credential resolver and live catalog behavior;
- provider-specific attribution/structured-output behavior;
- local Ollama onboarding and detection;
- active-provider environment precedence;
- fallback context-window resolution.

These exceptions are acceptable only when enumerated and tested. Otherwise the next provider change can
reintroduce the original fragmented matrix.

### Expected Behavior

A standard provider should require only a registry entry and catalog reference. Exceptional providers
must have explicit machine-readable or documented exception contracts. Automated checks must detect:

- provider URLs outside approved registry/test locations;
- hand-maintained provider ID lists;
- generated provider-doc drift;
- catalog prefix/protocol gaps;
- invalid credential/setup combinations;
- stale active-provider migration behavior;
- unsafe provider removal/fallback behavior.

### Evidence

```text
common/src/providers/registry.ts
  typed provider metadata and provider-specific fields.

common/src/providers/derive.ts
  pure derivations for prefixes, domains, setup, order, and live catalog URLs.

common/src/providers/validate.ts
  registry invariant checks and fixture validation.

scripts/generate-provider-reference.ts
  generated .env/provider reference surfaces with --check.

cli/src/utils/settings.ts and provider-setup.ts
  activeProvider migration and legacy direct-provider compatibility.

sdk/src/impl/model-provider.ts
  registry routing plus intentional active-provider/default-path behavior.
```

### Impact Assessment

- Future provider additions can regress one exceptional path.
- Legacy settings can be reintroduced as a second source of truth.
- A provider can be routable but absent from setup/catalog/docs or vice versa.
- Provider removal can strand persisted users without safe fallback.

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: current system is mostly consolidated; remaining risk is future drift
- [ ] Low

## Proposed Solution

### Approach

Treat the existing registry as the canonical source and add a completion audit around it. Do not
rewrite the completed registry phases. Add a fixture-provider contract, exception manifest, duplication
scans, removal/migration tests, and generated-surface checks through the validation program.

### Steps

1. Re-read archived registry FID and current provider sources; distinguish completed work from remaining gaps.
2. Enumerate every intentional provider exception and assign an owner/source.
3. Add a fixture-provider test covering routing, setup, catalog, docs, health, settings, and validation.
4. Add drift scans for URLs, IDs, generated blocks, catalog prefixes, and protocol maps.
5. Add provider-removal and stale-settings fallback fixtures.
6. Define legacy `directProvider` deprecation/retention policy without changing it in this planning FID.
7. Recheck context-window fallback layers and document whether consolidation is separate work.
8. Include provider checks in the validation/release manifest from FID-0809-004.

### Verification

- Fixture provider derives all standard surfaces without unrelated hand edits.
- Every exception is represented in the approved exception contract.
- Generated provider references pass `--check`.
- Duplication scans produce approved allowlists only.
- Provider removal/stale settings fail safely and preserve user guidance.
- Existing provider routing and credential precedence tests remain green.
- Call-graph search proves validation/generation checks are wired into root/release gates.
- No provider behavior changes before final approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Registry consolidation is already implemented historically, but intentional exceptions and
  future-addition invariants remain distributed. Reopening the completed FID would be wasteful; a
  follow-up completion audit is the correct scope.
- **GREEN:** Proposed fixture-provider, exception-manifest, duplication-scan, removal/fallback, and
  generated-doc checks integrated with the validation manifest.
- **AUDIT:** Evidence cites `common/src/providers/registry.ts:19`, `common/src/providers/validate.ts:71`,
  `common/src/providers/derive.ts:90`, `scripts/generate-provider-reference.ts:3,24`,
  `cli/src/utils/settings.ts:257-283`, and `sdk/src/impl/model-provider.ts:109-140`. The archived
  registry FID was inspected. No implementation change is claimed.
- **AUDIT ADVERSARIAL CHECK:** The FID must not duplicate or silently alter FID-0809-001. Its purpose is
  completion automation and exception governance only.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that provider drift checks must run through the healed boot and validation boundaries; otherwise a provider audit could pass while the active session contract remains ambiguous.
- **GREEN:** Added the bootup prerequisite relationship while preserving the archived unified registry as historical ground truth and keeping this FID limited to exception/drift automation.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; provider boundaries remain cited at `common/src/providers/registry.ts:19`, `common/src/providers/validate.ts:71`, `common/src/providers/derive.ts:90`, `scripts/generate-provider-reference.ts:3,24`, `cli/src/utils/settings.ts:257-283`, and `sdk/src/impl/model-provider.ts:109-140`. No implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** This dependency does not reopen FID-0809-001, rewrite historical records, or authorize provider behavior changes.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Does this FID replace the archived registry FID?** → No. It audits and automates remaining
   invariants around the completed direction.
2. **Should all special behavior be forced into data immediately?** → No. First enumerate and test
   exceptions; only a later approved FID may move a behavior into data.
3. **Should provider IDs be removed from every code file?** → Only if they are duplicate registry
   metadata; protocol-specific implementation names and tests may remain when approved.
4. **What happens when a provider is removed?** → Stale settings must be dropped or migrated to a safe
   documented fallback, never left to fail deep in routing.
5. **Should context-window cleanup be included here?** → Only its provider interaction/parity boundary;
   broad context policy remains separately scoped to avoid FID overlap.

### Code Verification Evidence

- [x] Archived unified-provider-registry FID inspected.
- [x] Current registry, derivation, validation, generator, settings, and SDK routing files inspected
  at the boundaries cited above.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] Follow-up automation implementation — prohibited pending approval and Nova sign-off.
- [ ] Future provider fixture results — intentionally pending implementation.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Provider registry audit is read-only, covers parity/drift/fallback surfaces, and does not change routing.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

A completed single-source-of-truth refactor still needs permanent drift tests. Centralization reduces
risk; it does not eliminate future exceptions or migration edges.

## Closure Evidence

- **FID:** FID-2026-0809-008
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.

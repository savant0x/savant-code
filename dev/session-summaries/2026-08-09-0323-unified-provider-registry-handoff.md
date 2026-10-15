<!-- markdownlint-disable MD013 -->

# Session Handoff: Unified Provider Registry — Implementation Complete, Awaiting Nova Sign-Off

**Session ID:** 2026-08-09-0323-unified-provider-registry-handoff
**Date:** 2026-08-09
**Status:** interrupted; implementation complete; one external verdict pending (Nova sign-off)

---

## Executive Summary

FID-2026-0809-001 (Unified Provider Registry — Single Source of Truth) reached the end of its
five-phase implementation. All five phases are implemented and each has a converged Perfection
Loop record (Loops 4–8) with independent ADVERSARIAL review dispositioned (no blocking findings
in any phase). A **Nova implementation sign-off request covering all five phase records** has been
filed in `dev/nova/outbox/` — the operator will have the sign-off completed for the morning.

The next session's only required action: **when the Nova verdict lands in
`dev/nova/inbox/`, close and archive FID-2026-0809-001** (set status Closed, move the file to
`dev/fids/archive/`, append a `CHANGELOG.md` entry) — unless Nova raises blocking objections.

The second in-flight FID, FID-2026-0809-002 (Release Binary Asset Verification + Frozen-Lockfile
Gate), is already at status `fixed` (implementation complete, Loop 4) and is awaiting its own
archival trigger (the next release publishing with assets).

---

## Verified Final State

### Git

- **Branch:** `main`
- **HEAD:** `37ebd8e docs: add completed release session handoff`
- **Worktree:** 76 changed/untracked entries — **NOT committed**. This session's provider-registry
  work is uncommitted by design (operator controls commits); the next session must NOT auto-commit.

### FID-2026-0809-001 — Unified Provider Registry (single source of truth)

- **Status:** `analyzed` — Phases 1–5 implemented 2026-08-09; close pending Nova sign-off
- **Phase 1 (Loop 4):** `common/src/providers/` (types, registry, derive, model-catalogs, org,
  barrel) + registry test suite; all six surfaces derive from it; four enumerated latent-gap
  deltas applied. Zero behavior change.
- **Phase 2 (Loop 5):** SDK routes via one ordered loop over `PROVIDER_REGISTRY`; generic
  `createProviderModel` replaces seven per-provider factories; `createSavantCodeBackendModel`
  renamed `createDefaultInferenceModel`; SDK has no provider URL literals. Zero behavior change.
- **Phase 3 (Loop 6):** cli `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG` deleted (derive from
  common `MODEL_CATALOGS`); generic `createLiveCatalogFetcher`; `inferContextLength` moved to
  common; live catalog URLs read from registry. Zero behavior change.
- **Phase 4 (Loop 7):** `activeProvider` single-setting state; `/provider` writes it; legacy
  `directProvider` migrates; env overrides authoritative; SDK bare-slug authorization uses the
  active provider's own key (decision 10). **ONE FID-sanctioned, operator-confirmed semantic
  delta** — everything else zero-behavior-change.
- **Phase 5 (Loop 8):** `validate.ts` pure registry validation + 12-test suite;
  `scripts/generate-provider-reference.ts` renders `.env.example` + release README provider table
  (`--check` drift guard); `docs/design/Adding New Providers.md` rewritten as the one-entry
  runbook; `docs/features.md` fixed. Zero runtime behavior change.
- **Nova chain:** design approval filed + verdict **PASS** (inbox, 2026-08-09);
  implementation sign-off request filed (outbox).

### FID-2026-0809-002 — Release Binary Asset Verification + Frozen-Lockfile Gate

- **Status:** `fixed` — Steps A1–A3 + B4–B6 + C7–C9 implemented (lockfile gate in
  `buildGateManifest`, `verifyReleaseAssets` in `POST_RELEASE_VERIFY`, post-matrix workflow job,
  legacy dispatch scripts retired, foreign repo reference removed). Loop 4 record complete.
- **Archival trigger:** pending — set Closed when the next release publishes with assets and is
  verified.

### Nova outbox (filed, awaiting response)

- `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-implementation-sign-off-request.md`
  (NEW this session — covers all five phase records)
- `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-nova-audit-request.md`
  (design request, already answered)

---

## Work Completed This Session

1. **Phase 5 implementation (FID-2026-0809-001):** `validate.ts` + 12-test validation suite
   (live-registry soundness, derivation parity, catalog agreement, nine negative fixture cases);
   `scripts/generate-provider-reference.ts` docs generator with side-effect-free `--check` mode;
   root scripts `generate:provider-docs` + `generate:provider-docs:check`; regenerated
   `.env.example` (stale `tokenrouter.me` gone; TokenHarbor + Cloudflare added) and
   `cli/release/README.md` provider table; `docs/design/Adding New Providers.md` rewritten as the
   one-entry runbook; `docs/features.md` provider list fixed.
2. **Loop 8 record** appended to the FID; header status, evidence checklist, and Resolution
   updated.
3. **Independent ADVERSARIAL review of Phase 5** — 4 findings dispositioned: 2 MINOR fixed
   (local-provider `setupAvailable` guard; negative-fixture count), 1 NIT fixed (decision-5
   "order uniqueness" wording — ties at order 4 intentional), 1 NIT refuted
   (`isProviderRegistryValid` exercised at test:30). No blocking findings.
4. **Fixed a document-order bug** in the FID (Loop 8 had landed before Loop 7; swapped to
   read 4→5→6→7→8).
5. **Filed the Nova implementation sign-off request** covering all five phase records, with
   drift-grep claims verified accurate before filing.

---

## Validation Evidence (all green this session)

- Typecheck × 4: common/sdk/agent-runtime exit 0; cli 0 non-TS6059 errors
- Common provider suites 21/0 (12 validate + 9 registry); common full suite green
- SDK full suite 456/0 (free-mode 11/0, incl. the 2 decision-10 tests)
- CLI targeted suites 47/0 + openrouter-models 18/0
- `bun run generate:provider-docs:check` exit 0 (docs byte-stable with registry)
- ESLint clean (after `--fix` of import-order warnings), Prettier clean, markdownlint clean on
  all changed docs/FID
- Drift-greps NO-MATCH: SDK factory URL literals, `TOKENROUTER_CATALOG`/`OPENCODE_GO_CATALOG`,
  `createSavantCodeBackendModel` (only in doc comments), `tokenrouter.me`

> **Pre-existing lint note:** `bun run lint:md` currently fails on `ECHO.md` (7 MD013/MD032
> errors at lines 100, 284, 286, 414, 629, 638, 668) from the operator's own working-tree edits
> (the EHEL documentation changes visible in `git status`). These are NOT from this session's
> work and should be fixed/committed by the operator or a dedicated task before the pre-push gate
> will pass.

---

## Important Files

- `dev/fids/FID-2026-0809-001-unified-provider-registry.md` — the FID (Loops 4–8 = phase records)
- `dev/fids/FID-2026-0809-002-release-binary-asset-verification.md` — release FID (status `fixed`)
- `dev/nova/outbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-implementation-sign-off-request.md`
  — the pending sign-off request
- `dev/nova/inbox/2026-08-09-fid-2026-0809-001-unified-provider-registry-nova-audit-response.md`
  — design approval verdict (PASS)
- `common/src/providers/` — the registry (types, registry, derive, model-catalogs, org,
  validate, barrel) + 2 test suites
- `sdk/src/impl/model-provider*.ts` + `sdk/src/impl/model-provider/` — data-driven routing
- `cli/src/utils/settings.ts`, `provider-setup.ts`, `ollama-onboarding.ts` — single-setting state
- `scripts/generate-provider-reference.ts` — docs generator
- `docs/design/Adding New Providers.md` — the one-entry runbook (the primary deliverable for the
  operator's upcoming "add A LOT of providers" effort)

---

## Pending Changelog Entries (DO NOT LOSE — write at FID close, not now)

The operator decided the CHANGELOG stays untouched until each FID closes. These entries are
**due** and all source data is captured here so nothing is lost. When a FID is set to Closed,
append its entry at the top of `CHANGELOG.md` (below the `# Changelog` header) before/while
moving the FID to `dev/fids/archive/`, then log the archival in that session's summary.

### Entry 1 — FID-2026-0809-001 Unified Provider Registry (Severity: high)

- **Trigger:** Nova sign-off verdict lands (inbox) and FID is closed + archived.
- **Title suggestion:** `## Unified provider registry — single source of truth (FID-2026-0809-001)`
- **Description:** Replaced the fragmented provider metadata (base URLs duplicated across SDK
  factories + CLI setup, provider list enumerated in nine-plus places, model catalogs duplicated
  between `common` and `cli`) with **one typed, data-only `PROVIDER_REGISTRY` in `common`** from
  which every provider surface derives (routing, credentials, `/provider` setup, picker
  sections, logos, ordering, guidance, health). The single user setting is `activeProvider`
  (persisted UI selection); legacy `directProvider` migrates onto it; env overrides remain
  authoritative. Adding a provider is now **one registry entry + a catalog reference** (runbook:
  `docs/design/Adding New Providers.md`). One FID-sanctioned semantic change: bare-slug model
  ids authorize with the active provider's own key (decision 10).
- **Implementation:** Phases 1–5 (Loops 4–8): registry + derivation → data-driven SDK routing
  → catalog unification → single-setting state → validation suite + docs generator
  (`validate.ts` 12 tests; `generate-provider-reference.ts` renders `.env.example` + release
  README provider table with `--check` drift guard).
- **Verification (all green):** typecheck × 4; common provider suites 21/0; SDK full 456/0
  (free-mode 11/0); CLI targeted 47/0 + openrouter-models 18/0; `generate:provider-docs:check`
  exit 0; ESLint + Prettier + markdownlint clean; drift-greps NO-MATCH.
- **Archive path:** `dev/fids/archive/FID-2026-0809-001-unified-provider-registry.md`

### Entry 2 — FID-2026-0809-002 Release Binary Asset Verification + Frozen-Lockfile Gate (Severity: critical)

- **Trigger:** The next release publishes with binary assets and is verified (per the FID's own
  Resolution note: "Archived: Pending — set when the next release publishes with assets and is
  verified"). FID is already at status `fixed`.
- **Title suggestion:** `## Release binary asset verification + frozen-lockfile gate (FID-2026-0809-002)`
- **Description:** v0.0.21 published to npm with **zero binary assets** (the launcher-only npm
  package downloads binaries from GitHub release assets; a stale `bun.lock` failed
  `bun install --frozen-lockfile` in the binary-build workflow, so no assets were uploaded).
  Fixed with a three-part gate: (A) frozen-lockfile gate in `buildGateManifest`; (B)
  `verifyReleaseAssets` in `POST_RELEASE_VERIFY` (fail-closed with retry, 0-vs-5-asset
  distinction); (C) post-matrix workflow verify job + legacy dispatch scripts retired + foreign
  repo reference removed.
- **Verification:** `bun install --frozen-lockfile` exit 0 (pinned Bun 1.3.14); release contract
  suite 52/53 (sole failure pre-existing + environment-dependent, confirmed on pristine HEAD);
  ESLint clean; scripts bundle check clean. Nova audit: DESIGN READY (all targets PASS).
- **Archive path:** `dev/fids/archive/FID-2026-0809-002-release-binary-asset-verification.md`

---

## Next Session: Safe Starting Procedure

1. **Read this handoff first**, then `dev/nova/inbox/` — check for the Nova sign-off verdict on
   FID-2026-0809-001 (the operator said it will be ready in the morning).
2. **If the verdict is PASS (expected):** close and archive FID-2026-0809-001 — set status
   `Closed`, move the file to `dev/fids/archive/`, append a `CHANGELOG.md` entry with FID ID,
   severity, description, and resolution summary, and log the archival in the session summary.
   **If verdict is FAIL or has blocking objections:** disposition each finding with mechanical
   evidence and re-run the affected phase's loop before any close.
3. **Confirm the working tree state** before any commit — the 76 changed/untracked entries span
   this session's provider work, FID-2026-0809-002 release work, and the operator's own ECHO.md
   edits. Do not auto-commit; surface the split for operator decision.
4. **Fix the pre-existing `ECHO.md` markdownlint failures** (or coordinate with the operator)
   before any push — the pre-push gate runs `bun run lint:md`.
5. **Do not rerun** `release:public`, `release:public:resume`, `git push`, `git tag`,
   `gh release`, or `npm publish` unless a new release is explicitly approved.
6. The operator plans to **add many providers** — the one-entry flow is documented in
   `docs/design/Adding New Providers.md` (registry entry + catalog reference + regenerate docs:
   `bun run generate:provider-docs`). FID-2026-0809-001 must be closed/archived first.

---

## No Current Blockers

The implementation is complete and validated. The only pending item is the external Nova sign-off
verdict (expected morning). No code changes are required to proceed to close.

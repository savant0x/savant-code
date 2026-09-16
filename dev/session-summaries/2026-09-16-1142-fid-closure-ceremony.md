# Session Summary — 2026-09-16 1142 — FID-2026-0916-001/-002 closure ceremony

**Operator directive:** "Close and archive the two fixed FIDs (001 + 002)
with CHANGELOG entries."

## 1. Ground truth before closure

- Both FIDs read 0-EOF; every implementation claim re-verified at file:line
  in the working tree:
  - 001: `scripts/providers/lib/audit-trail.ts:18` (pure
    `buildExclusionAuditRows`), `lib/candidates-io.ts:55`
    (`mergeDenylist` both-shape normalization), `lib/propose-guard.ts` +
    `propose-provider.ts:17` (fail-closed tracked-host guard),
    `lib/probe-endpoint.ts:71/:167` (https + public-host trust boundary)
    with the `allowPrivate` Stage-E path at `harvest-report-phase.ts:127`.
  - 002: `common/src/constants/context-windows.ts:160`
    (`tokenharbor/deepseek-v4-flash` → 1,048,576), all four fetchers on
    `getContextWindowFallback` (`static-catalogs.ts:144/167/185/202`),
    dead-id absence pins (`window-truth.test.ts:117-136`),
    `TOKENROUTER_PROTOCOLS` + registry `multi`/`protocolMap`
    (`registry.ts:56-58`).
- **Residue found on 002:** the "display-name map pruned in step" claim was
  partially inaccurate — `tokenrouter/z-ai/glm-5.3-free` survives in
  `TOKENROUTER_NAMES` + `TOKENROUTER_MAX_OUTPUT`
  (`cli/src/utils/openrouter-models/static-catalogs.ts:59/:124`). Inert
  (picker id set derives from common; MAX_OUTPUT anchors the
  pin-resolution probe). FID record amended; routed
  [OPEN-OUT-OF-SCOPE] in SCOPE Task 55 — cleanup is a separate Law-2
  decision, not smuggled into the closure.

## 2. Gates re-run (all green)

- typecheck cli exit 0; typecheck common exit 0.
- FID-001 declared suites: harvest-core + pipeline-integrity — 28 pass /
  89 expect / 0 fail.
- FID-002 declared suites: static-catalogs + window-truth +
  context-window-fallbacks — 39 pass / 825 expect / 0 fail.
- Repo-wide `fid:verify --check` PASS; lint:md exit 0; prettier clean on
  touched files.

## 3. Closure execution

- Statuses flipped `fixed` → `closed` with closure sections (commit
  evidence, gate results, the 002 ground-truth correction).
- Receipts re-stamped via `fid:verify --write` on the closed content:
  001 5/5 (typecheck ×2, two suites, LIVE harvest probe exit 0);
  002 6/6 (typecheck ×2, three suites, LIVE verify-window-truth probe
  exit 0).
- `git mv` both records to `dev/fids/archive/`; ledger rows → closed with
  narrative; archive-index section added; CHANGELOG `Unreleased` entries
  appended (feature-scale, per the house style); SCOPE Task 55 recorded;
  active FID queue is empty.

## Standing items (unchanged)

- T51-F [BLOCKED — operator]: bazaarlink paid-channel gauntlet
  (zero-credit account).
- T51-G [BLOCKED — operator]: prorisehub keyed curation (no key in
  `.env.local`).
- [OPEN-OUT-OF-SCOPE] tokenrouter dead-id residue in the two cli display
  maps (SCOPE Task 55) — FID on request.

# FID: Pipeline integrity hardening — denylist accumulation, silent-class audit, propose guard, probe URL safety

**Filename:** `FID-2026-0916-001-pipeline-integrity-hardening.md`
**ID:** FID-2026-0916-001
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-16 (operator: "make fid to address all 4 issues, run
perfection loop on it then present for final approval" — the four findings
from the T52 deep audit, SCOPE Task 52)

## Summary

Fix the four defects the provider-suggestions deep audit (Task 52) found in
the discovery pipeline, preserving every existing behavior that is correct:

1. **Denylist never accumulates (bug).** `mergeDenylist` writes
   `{_meta, entries: [...]}` but its reader branch only accepts a bare
   `Array` — so the persisted shape it wrote on the previous run is
   silently discarded and the file resets every run. LIVE proof
   (2026-09-16): 118 entries, all `decision=excluded`, all
   `firstSeenUtc === lastSeenUtc`, single day `2026-09-15`, and zero
   `rejected`/`flagged` rows persisted despite two LIVE open-relay
   rejections in past runs (b.ai, platform.experientiallabs.ai —
   FID-2026-0915-003). Zero test coverage guarded the seam.
2. **Silent-class audit gap (report honesty).** Stage-0 exclusions other
   than risky/down/free-relay (unconfirmed category, monitor-directory,
   free-product, unreachable-probe) produce NO audit-trail rows — the
   report's "every gate decision, with reason" claim covers fewer than
   half the feed. Re-confirmed on the fresh 2026-09-16 artifact.
3. **`providers:propose` is unconstrained.** It accepts any host string
   with no check against the tracked candidate set: a host the pipeline
   never saw gets a scaffold with no warning at all; only a tracked
   open-relay host gets the DO-NOT-CURATE warning (and only if state
   exists).
4. **Probe URL safety is accidental, not designed.** Feed-derived URLs
   flow to `fetch` unvalidated — a hostile feed could aim probes at
   loopback/private-range addresses (SSRF). Mitigations exist (10s
   timeout, read-only, keyless) but the trust boundary should be
   explicit.

## Problem Statement

The pipeline's integrity claims rest on its artifacts being honest and its
gates being deliberate. Finding 1 makes the long-horizon denylist (W3,
FID-2026-0915-001) silently worthless; finding 2 makes the report's
completeness claim false; finding 3 lets an untracked host enter the
curation flow outside the pipeline's evidence; finding 4 leaves the probe
target set defined by whatever the feed says rather than by policy.

## Scope Boundary

Fix exactly these four findings. No gate logic changes (stage-0 rules,
typosquat tiers, boundary verdicts stay byte-identical); no report layout
changes beyond the new silent-class rows and one summary row; no new
pipeline stages. The denylist stays a gitignored, never-consumed-by-product
artifact (accumulation is the fix — not wiring it into gates; that would be
a behavior change requiring its own ruling).

## Perfection Loop

### Missed Questions

- **MQ1 — denylist shape contract:** `mergeDenylist` normalizes BOTH
  persisted shapes — the current `{_meta, entries}` object AND a bare
  array (the shape its reader branch already handles, kept for
  compatibility). The function owns the shape contract (one truth);
  the caller's read path is unchanged. Same `host::reason` key merge,
  same firstSeen-preserve / lastSeen-bump semantics.
- **MQ2 — silent-class row shape:** modeled exactly on the existing
  risky/down/free-relay rows (`decision: 'excluded'`, class-specific
  reason strings), so the audit section, denylist, and summary counts
  pick them up with no renderer changes. The main() audit-trail block
  moves to `lib/audit-trail.ts` (extract + extend) so it is testable;
  the three existing reason strings stay byte-identical (report-stable
  parity).
- **MQ3 — propose guard semantics:** fail-closed for hosts absent from
  the tracked candidate set (exit 1 + remediation message: run harvest
  first / use an operator seed). A TRACKED host always scaffolds —
  including a tracked open-relay, which keeps the existing DO-NOT-CURATE
  warning (an evidence trail beats silence; the hard rejection already
  happened at the LIVE probe gate).
- **MQ4 — probe trust boundary:** `probe-endpoint` admits only
  `https://` URLs whose host is a public address. Static checks reject
  wrong scheme, localhost/loopback literals (v4 + v6), private/link-local
  ranges (10/8, 172.16/12, 192.168/16, 169.254/16, 127/8, 0/8, ::1,
  fc00::/7, fe80::/10), and non-dotted decimal/octal/hex integer host
  forms. At probe time the hostname is DNS-resolved first and any
  resolved loopback/private/link-local address rejects (hostname-based
  SSRF closed). Candidate/seed probes (feed- and seed-derived) are
  guarded; the Stage-E health path passes `allowPrivate: true` — those
  URLs came from operator-stamped custom providers, an explicit trust
  act (a local Ollama custom must remain health-checkable).
- **MQ5 — verification gates:** typecheck ×2 (cli, common), the
  pipeline suite's two anchor files (existing harvest-core + the new
  pipeline-integrity pins), and a LIVE harvest probe gate (the FID-003
  precedent) whose re-run must show accumulation: pre-existing rows
  keep their original `firstSeenUtc` (dates from 2026-09-15) while the
  file gains the current run's rows. Report bytes vary run-to-run
  (generated timestamp), so pins target state/denylist shapes and
  report sections — never whole-file bytes.

### Code Verification Evidence

Ground truth established before this FID (Task 52 audit, 2026-09-16):

- `scripts/providers/lib/candidates-io.ts` — `mergeDenylist` reads only
  `Array.isArray(previous)`; `harvest-report-phase.ts` passes the parsed
  `{_meta, entries}` object it just wrote last run.
- LIVE `dev/provider-candidates/denylist.json`: 118 entries, decisions
  `{"excluded": 118}`, `firstSeenUtc === lastSeenUtc` on all 118,
  distinct firstSeen days = `2026-09-15` only.
- `scripts/providers/harvest-freeairouter.ts` — the exclusion audit
  branches cover exactly risky / free-relay / down; no other class
  renders a row. Fresh report contains zero silent-class rows.
- `scripts/providers/propose-provider.ts` — host taken from argv with
  no validation beyond the dev/ write guard.
- `scripts/providers/lib/probe-endpoint.ts` — `fetchImpl(baseUrl …)`
  with no scheme/host validation on either probe leg.

## Implementation (2026-09-16)

RED-first: `pipeline-integrity.test.ts` (16 pins) failed with
`Cannot find module '../lib/audit-trail'` before GREEN; the two failures
after module 3 (denylist `lastSeen` semantics; `isPrivateAddress`
hostname overreach) were the pins catching real defects in my own drafts
— both fixed in the modules, not the pins. GREEN surfaces:

- `lib/audit-trail.ts` (new) — pure `buildExclusionAuditRows` owning all
  exclusion reasons; legacy three classes byte-identical, five
  silent classes added (unconfirmed / monitor-directory /
  free-product / no-probe-data / unreachable).
- `harvest-freeairouter.ts` — the inline exclusion block replaced by the
  builder call (report-stable parity pins hold).
- `lib/candidates-io.ts` — `mergeDenylist` normalizes BOTH persisted
  shapes (the `{_meta, entries}` object it writes AND legacy bare
  arrays); persisted `lastSeenUtc` preserved (it means "last gate
  sight", not "last file write").
- `lib/propose-guard.ts` (new) + `propose-provider.ts` — fail-closed
  tracked-candidate guard (exit 1 + remediation), all three state
  shapes parsed like discovery-state-io.
- `lib/probe-endpoint.ts` — MQ4 trust boundary: `isPublicProbeUrl`
  static checks (https-only, reserved-host literals, private ranges,
  non-canonical integer/hex/octal host forms) + a resolving DNS check
  via injectable `lookupImpl` (DI per repo convention);
  `allowPrivate` for the Stage-E operator-stamped path only.
- `lib/report-format.ts` + `lib/report.ts` — counted groups + summary
  row for the five silent classes.

LIVE proof (three harvest runs, exit 0 each): denylist 118 → 163
entries with all 118 pre-FID rows keeping their original `firstSeenUtc`
and re-sighted rows' `lastSeenUtc` correctly bumped; decisions
`{excluded: 159, flagged: 4}` — flagged rows persisted for the first
time; report now renders the five silent-class groups (18+12+5+4+2 =
41 rows) plus the summary row. Propose refuses an untracked host with
exit 1 and writes nothing. Suite 85 → 101 (16 new pins), 411 expects,
0 fail; eslint/prettier/lint:md 0; typecheck cli + common 0.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test scripts/providers/__tests__/harvest-core.test.ts
- gate: test scripts/providers/__tests__/pipeline-integrity.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts

### Verification Receipt

- fingerprint: sha256:1c46a386d062197a20d4db89f466cf97a05c4bbb5b1eb1afde2a33256be3e14e
- verified: 2026-09-16T02:40:52.127Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test scripts/providers/__tests__/harvest-core.test.ts: exit 0
- test scripts/providers/__tests__/pipeline-integrity.test.ts: exit 0
- probe scripts/providers/harvest-freeairouter.ts: exit 0

## Lessons Learned

- The audit trail's completeness claim was falsified by its own
  denylist artifact: only 118 excluded rows survived repeated runs
  (all same-day) while two LIVE open-relay rejections were never
  persisted. A write-only artifact with zero test coverage rotted
  silently — the round-trip (write shape == read shape) needed a pin.
- Pins caught two defects in the fix itself (lastSeen semantics;
  an over-broad private-IP classifier that would have blocked every
  public hostname) — RED discipline pays twice.
- Tests that stub `fetch` on fake hostnames also need the resolver
  injected (DI for DNS, per repo convention) once a trust boundary
  resolves hostnames before the network call.

# Pending-FIDs completion pass — 2026-10-08

## Authorization and intent

Operator directive: "complete all of them in logical order and complete all
pending fids" (the four active records `-011`, `-014`, `-016`, `-012`),
with the mid-pass correction that the perfection loop runs on the FID, not
the code (Loop 3s), followed by implementation authorization. Single-agent
ECHO v0.1.2, strict mode, automation level 3. No code was written without a
converged record; no operator-sovereign decision was picked silently
(blockers registered, defaults named).

Order executed: `-011` → `-014` → `-016` → `-012` phases (research, 1, 2,
3, 4, 6, 7). First three are tooling/tests (zero production behavior);
`-012` builds new surfaces last. FID 5 (desktop panel) is NOT done —
placement is operator-sovereign (BO Q4, deferred by the build order itself)
with a parallel UI session active; recon is mapped, question posed below.

## Completed

- **`FID-2026-1007-011` (T164-B) — CLOSED + archived.** Coverage suite
  (`tree-drain-manifest-coverage.test.ts`, 7 pins incl. fixture negative
  legs) + manifest header rule. Receipt 2/2 (`sha256:9ee213ef…`).
- **`FID-2026-1007-014` (T164-E) — CLOSED + archived.** G2/G5 pre-audit
  family (`pre-audit-g2-g5.ts` + 20 pins across two suites + commit
  baseline ratchet) wired into `runPreAudit`. Live design corrections:
  152 → 18 → 0 findings (filename-date fallback per the -013 precedent;
  status-line commit source; Resolution-prose mining rejected on the
  `f099ded8` false positive). Receipt 3/3 (`sha256:d9724ec0…`).
- **`FID-2026-1007-016` (T165) — CLOSED + archived.** Control seam
  (`identity-controls.ts` manifest loader, `identity-sweep.ts` extraction,
  `--controls-manifest`/`--max-control-probes`, verdict rendering) + the
  `glm-5.3-flash` substitution re-captured live to an artifact. Remainder
  registered as `T175`. Receipt 4/4 (`sha256:53cdb7d7…`).
- **`FID-2026-1007-012` (T164-C) — 6 of 7 phases landed, record OPEN.**
  Research pass (emission map + prior-art scan, BO `source_research`
  filled); FID 1 schema (`common/src/types/telemetry.ts`, 6 pins); FID 2
  sink (`hooks/compliance-capture.ts` + 4-funnel wiring + kill-switch +
  churn listing, 12 pins); FID 3 aggregate (shared `common` module +
  script wrapper + purge + aliases, 6 pins); FID 4 CLI group (8 pins,
  registry/menu parity); FID 6 sentinel (drift ledger, 4 pins); FID 7
  feedback (idempotent drafts, no auto-promotion, 4 pins).

## Design corrections made mid-flight (all recorded in the FIDs)

- `-014`: G2 window refined twice under live fire; baseline ratchet added
  (house pattern); combined suite split under the 300 cap.
- `-016`: single-control design corrected to control pairs (verdictFor
  demands both + ≥2 probes); `runSweep` extracted under the file cap.
- `-012`: schema strictness yielded to the sibling `experienceRecordSchema`
  discipline; aggregation moved to `common/` for the CLI↛scripts boundary;
  threading design replaced by session-state-carried roots (zero signature
  sprawl; `tool-pipeline.ts` byte-identical to HEAD); tie-break rule made
  explicit; tracking policy set (tracked source, ignored derived/drafts).

## Open Knight decisions (named, not picked)

- `-014`: G2 window scope, G5 staleness constant, pre-push-hook layer,
  template hash-shape wording.
- `-016`/T175: manifest authorship, re-run funding, ToS, budget number,
  no-control naming, rotation source.
- `-012`: tracked+dedup git policy, agenda competition, wire-list approval
  (defaults adopted in-record); Q1 retention (90d purge built), Q2
  default-on (built per BO rec); model identity threading + runId session
  follow-ups; SessionEnd-hook surfacing for drafts; FID 5 placement (below).
- Live boundaries: full `release:preaudit --check` cannot complete here
  (pre-existing 157-ahead push-range scan >300 s); `-011`/`-014`/`-016` and
  `-012` phases carry "commit pending operator G2" (working tree).

## Pending: FID 5 (desktop panel)

Recon mapped: gateway `*-rpc.ts` module pattern (renderer ↔ CLI sidecar
JSON-RPC), no perf-hud remnant (floor/ holds deck-view/stations/office),
parallel session `FID-2026-1008-006` (T174, sidebar console, registered and
passing gates) active in desktop UI. Panel placement per BO Q4 defers to
layout decisions that session may own — operator ruling needed before
implementation: dedicated region vs tab, and collision clearance with T174.
Data path (new `telemetry` gateway method + renderer hook + panel with empty
state + seeded e2e) is fully specified in the BO and unblocked once placed.

## Verification (this session, live output)

Per-phase gates all green at completion time; final battery re-ran clean:
`lint:md` exit 0, `scope-register-check` PASS, `validate:repository` PASS
(incl. file-cap ratchet + archived-closure probe), `quality` PASS (1498),
`typecheck` (common, agent-runtime, cli, scripts) exit 0, eslint 0
everywhere touched, prettier clean. Production reachability held: every new
function verified called (Law 4) except the operator-triggered CLI/scripts
entries (by design).

## Staging (operator G2 — nothing staged or committed here)

Closure docs for `-011`/`-014`/`-016` (archive records + receipts, removals,
CHANGELOG ×3, both READMEs, SCOPE evictions, `dev/preaudit-g2-commit-baseline.json`)
plus `-012` phase work (schema/sink/aggregate/CLI/sentinel/feedback, tests,
config, grants, BO/FID progress, new session file) plus this summary.
Suggested: review with `git status --short` + `git diff --cached --check`
after staging, then commit as one batch. All `-011`/`-014`/`-016`/`-012`
implementation from this pass is working-tree code (no commits exist for it
yet); the cited October SHAs are the pre-existing implementation commits of
the earlier batch.

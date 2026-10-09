# Perfection loops on the four pending FIDs — 2026-10-08

## Authorization and intent

Operator directive: "run the full perfection loop on all of them" (the four
active records `-011`, `-012`, `-014`, `-016`), with the mid-pass correction
that the loop runs on the FID, not the code — document convergence only, no
implementation. Single-agent ECHO v0.1.2, strict mode, automation level 3.

Each record got RED re-verification against the live tree, GREEN folds of
anything the audit surfaced, double audit (tool/file evidence plus re-read),
SELF-CORRECT where warranted, and a Loop 3 convergence entry. All edits are
document-only; no runtime behavior changed this pass.

## Per-record outcome

| FID | Prior status | Loop result | Document changes |
| --- | --- | --- | --- |
| `FID-2026-1007-011` (T164-B, drain-manifest test) | `converged` | CONVERGED, status unchanged | Loop-2 both-direction pins folded into Steps 2–3; stale 35-counts corrected to 36 in Evidence, Code Verification Evidence, Loop 1 |
| `FID-2026-1007-014` (T164-E, G2/G5 preflight) | `created` | CONVERGED, status `created` → `analyzed` | Archive count 496 → 505; ruling recorded (Loop-2 GREEN fold complete, precedent: `-012` Loop 2) |
| `FID-2026-1007-016` (T165, sweep verdict controls) | `created` | CONVERGED, status `created` → `analyzed` | Same ruling precedent; RED re-verified to exact lines (`matrix.ts:72,77-81,111`; `manifest.ts:78`; `runner.ts:227,263-270`; `core.ts:190`) |
| `FID-2026-1007-012` (T164-C, compliance telemetry) | `analyzed` | CONVERGED, status unchanged | RED absences re-proven; research precondition restated as implementation-phase work, not a document gap |

Operator-sovereign items stay recorded as blocked, not defaulted: `-014`
(G2 window scope, G5 staleness constant, enforcement layer, template
hash-shape wording); `-016` (re-run funding, manifest authorship, ToS
comfort, probe budget, no-control naming); `-012` (tracked+dedup policy,
agenda competition, emitting wire-list approval).

## Verification

```text
lint:md (markdownlint .): exit 0
scope-register-check: PASS (0 issues)
validate:repository: PASS (provider docs counts match; no unevidenced fact drift)
prettier --check on all four touched FIDs: clean
fid:verify --check on pre-implementation records: informational "no gates
  declared" — proven uniform across untouched -012/-014/-016, not a defect
```

Two audit findings were investigated and dismissed with evidence rather than
edited: the `fid:verify` informational output above, and `-011`'s non-vocabulary
`converged` status (tolerated by every repo gate and the only value describing
design-converged/implementation-pending). One suspected contradiction
(`typecheck:scripts` named in `-011` Verification vs not-a-declarable-gate)
was cleared: the command exists (`package.json:69`) while the gate shape does
not — consistent, not contradictory.

## Staging

Working-tree additions to the prior closure state, for the operator's commit
(G1/G2 — nothing staged or committed here):

```powershell
git add -- `
  dev/fids/FID-2026-1007-011-tree-drain-manifest-move-safety.md `
  dev/fids/FID-2026-1007-012-model-compliance-telemetry.md `
  dev/fids/FID-2026-1007-014-release-preflight-g2-g5-audit.md `
  dev/fids/FID-2026-1007-016-provider-identity-sweep-verdict-controls.md `
  dev/session-summaries/2026-10-08-perfection-loops-four-pending-fids.md
```

Implementation of all four records awaits separate authorization.
